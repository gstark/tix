/** @jsxImportSource @opentui/react */
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { KeyEvent, ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useRenderer, useSelectionHandler, useTerminalDimensions } from "@opentui/react";
import { useMemo, useRef, useState } from "react";
import { api } from "../../convex/_generated/api.js";
import type { ListFilter, TaskListItem } from "../client.ts";
import type { Git } from "../git.ts";
import { boardRows, matches, statusCounts, statusOf, taskRows } from "./board.ts";
import { Board, rowId } from "./Board.tsx";
import type { Choice, Field } from "./Dialogs.tsx";
import { Confirm, Form, Help, Picker } from "./Dialogs.tsx";
import type { Live } from "./live.ts";
import { useConnected, useLive } from "./live.ts";
import { color, markdownStyle, statusColor } from "./theme.ts";
import { Ticket } from "./Ticket.tsx";

export type Scope = { kind: "project"; key: string } | { kind: "all" };

const FILTERS: ListFilter[] = ["open", "ready", "all", "closed"];

/** Below this width the board and the ticket take turns on the full screen. */
const NARROW = 100;

type Dialog =
  | { kind: "help" }
  | { kind: "form"; title: string; fields: Field[]; save: string; onSave: (values: Record<string, string>) => void }
  | { kind: "picker"; title: string; choices: Choice[]; empty: string; onPick: (value: string) => void }
  | { kind: "confirm"; title: string; message: string; yes: string; onYes: () => void };

type Toast = { text: string; tone: "ok" | "error"; id: number };

type Props = { live: Live; scope: Scope; git: Git; cwd: string; onQuit: () => void };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parsePriority(text: string): number {
  if (!/^\d+$/.test(text.trim())) throw new Error("The priority must be a whole number from 0 to 100");
  return Number(text.trim());
}

/** The number of listed descendants of a task. */
function descendantCount(tasks: TaskListItem[], shortId: string): number {
  const kids = tasks.filter((task) => task.parentShortId === shortId);
  return kids.reduce((sum, kid) => sum + 1 + descendantCount(tasks, kid.shortId), 0);
}

export function App({ live, scope: initialScope, git, cwd, onQuit }: Props) {
  const renderer = useRenderer();
  const syntaxStyle = useMemo(() => markdownStyle(renderer), [renderer]);
  const { width, height } = useTerminalDimensions();

  const [scope, setScope] = useState<Scope>(initialScope);
  const [filter, setFilter] = useState<ListFilter>("open");
  const [selectedId, setSelected] = useState<string | null>(null);
  // Keys can arrive faster than renders. The next move starts from the last choice, not the last render.
  const latestId = useRef<string | null>(null);
  const setSelectedId = (shortId: string | null) => {
    latestId.current = shortId;
    setSelected(shortId);
  };
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState<"board" | "ticket">("board");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const boardRef = useRef<ScrollBoxRenderable>(null);
  const ticketRef = useRef<ScrollBoxRenderable>(null);

  const list = useLive(
    live,
    api.tasks.list,
    scope.kind === "all" ? { filter, allProjects: true } : { filter, projectKey: scope.key },
  );
  const projects = useLive(live, api.projects.list, {});
  const connected = useConnected(live);
  const tasks = list.data ?? [];
  const rows = useMemo(
    () => boardRows(tasks, { collapsed, query, grouped: scope.kind === "all" }),
    [tasks, collapsed, query, scope.kind],
  );
  const selectable = taskRows(rows);
  const selected = selectable.find((row) => row.task.shortId === selectedId) ?? selectable[0] ?? null;
  const item = selected?.task ?? null;
  const detail = useLive(live, api.tasks.get, item === null ? null : { id: item.shortId });
  const task = detail.data?.shortId === item?.shortId ? detail.data : undefined;

  const narrow = width < NARROW;
  const boardWidth = narrow ? width : Math.min(96, Math.max(48, Math.floor(width * 0.5)));

  // Actions -----------------------------------------------------------------

  const flash = (text: string, tone: Toast["tone"]) => {
    const id = Date.now();
    setToast({ text, tone, id });
    setTimeout(() => setToast((current) => (current?.id === id ? null : current)), tone === "ok" ? 3000 : 6000);
  };

  const copyText = (text: string, done: string) => {
    const copied = renderer.copyToClipboardOSC52(text);
    flash(copied ? done : "This terminal does not let tix use the clipboard", copied ? "ok" : "error");
  };

  // tix takes the mouse, so the terminal has no selection for its own copy key. Copy the selection when the drag ends.
  useSelectionHandler((selection) => {
    const text = selection.getSelectedText();
    if (text.trim() !== "") copyText(text, `Copied ${text.length} character${text.length === 1 ? "" : "s"}`);
  });

  /** Runs a change. The live list shows the result, so only the toast is left to do. */
  const act = (done: string, run: () => Promise<unknown>) => {
    setDialog(null);
    run().then(
      () => flash(done, "ok"),
      (error: unknown) => flash(messageOf(error), "error"),
    );
  };

  const select = (shortId: string) => {
    setSelectedId(shortId);
    boardRef.current?.scrollChildIntoView(rowId(shortId), { align: "nearest" });
    ticketRef.current?.scrollTo(0);
  };

  const move = (delta: number) => {
    if (selectable.length === 0) return;
    const latest = selectable.findIndex((row) => row.task.shortId === latestId.current);
    const index = latest >= 0 ? latest : selected === null ? 0 : selectable.indexOf(selected);
    const next = Math.max(0, Math.min(selectable.length - 1, index + delta));
    select(selectable[next].task.shortId);
  };

  const setCollapsedFor = (shortId: string, close: boolean) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (close) next.add(shortId);
      else next.delete(shortId);
      return next;
    });
  };

  /** Opens a task from a link. It opens collapsed ancestors, and shows all tasks if the filter hides it. */
  const jump = (shortId: string) => {
    const byId = new Map(tasks.map((each) => [each.shortId, each]));
    if (!byId.has(shortId)) setFilter("all");
    setCollapsed((current) => {
      const next = new Set(current);
      let parent = byId.get(shortId)?.parentShortId ?? null;
      while (parent !== null) {
        next.delete(parent);
        parent = byId.get(parent)?.parentShortId ?? null;
      }
      return next;
    });
    setFocus("board");
    select(shortId);
  };

  const projectFor = (): string | null => (scope.kind === "project" ? scope.key : (item?.projectKey ?? null));

  const taskForm = (title: string, save: string, parent: string | null, projectKey: string) =>
    setDialog({
      kind: "form",
      title,
      save,
      fields: [
        { key: "name", label: "Name", kind: "line", initial: "", placeholder: "What must be done" },
        { key: "priority", label: "Priority, 0 to 100. Lower goes first", kind: "line", initial: "1" },
        { key: "description", label: "Description, in Markdown", kind: "text", initial: "", placeholder: "The plan, the context, and how to check the work" },
      ],
      onSave: (values) =>
        act(`Created ${values.name}`, async () => {
          if (values.name.trim() === "") throw new Error("The name is empty. Type a name, then save");
          const created = await live.mutate(api.tasks.create, {
            projectKey,
            name: values.name.trim(),
            description: values.description,
            priority: parsePriority(values.priority),
            parent: parent ?? undefined,
          });
          if (parent !== null) setCollapsedFor(parent, false);
          setSelectedId(created.shortId);
        }),
    });

  const actions = {
    start: () => {
      if (item === null || item.completed || item.startedAt !== null) return;
      act(`Started ${item.shortId}`, () => live.mutate(api.tasks.start, { id: item.shortId }));
    },
    done: () => {
      if (item === null || item.completed) return;
      setDialog({
        kind: "form",
        title: `Close ${item.shortId}`,
        save: "Close task",
        fields: [
          { key: "result", label: "Result, in Markdown", kind: "text", initial: "", placeholder: "What was done, how it was checked, and what is left" },
          { key: "commit", label: "Commit", kind: "line", initial: "", placeholder: "A ref such as HEAD. Leave it empty to link no commit" },
        ],
        onSave: (values) =>
          act(`Closed ${item.shortId}`, async () => {
            const ref = values.commit.trim();
            const commit = ref === "" ? undefined : await git.commit(cwd, ref);
            if (commit === null) throw new Error(`${ref} is not a commit in ${cwd}`);
            const result = values.result.trim();
            await live.mutate(api.tasks.complete, { id: item.shortId, result: result || undefined, commit });
          }),
      });
    },
    reopen: () => {
      if (item === null || !item.completed) return;
      act(`Reopened ${item.shortId}`, () => live.mutate(api.tasks.reopen, { id: item.shortId }));
    },
    create: () => {
      const key = projectFor();
      if (key === null) return flash("Choose a project first. Press p", "error");
      taskForm(`New task in ${key}`, "Create task", null, key);
    },
    subtask: () => {
      if (item === null) return;
      taskForm(`New subtask under ${item.shortId}`, "Create subtask", item.shortId, item.projectKey);
    },
    edit: () => {
      if (task === undefined) return;
      setDialog({
        kind: "form",
        title: `Edit ${task.shortId}`,
        save: "Save changes",
        fields: [
          { key: "name", label: "Name", kind: "line", initial: task.name },
          { key: "priority", label: "Priority, 0 to 100. Lower goes first", kind: "line", initial: String(task.priority) },
          { key: "description", label: "Description, in Markdown", kind: "text", initial: task.description },
        ],
        onSave: (values) =>
          act(`Saved ${task.shortId}`, async () => {
            const priority = parsePriority(values.priority);
            await live.mutate(api.tasks.update, {
              id: task.shortId,
              name: values.name.trim() === task.name ? undefined : values.name.trim(),
              description: values.description === task.description ? undefined : values.description,
              priority: priority === task.priority ? undefined : priority,
            });
          }),
      });
    },
    editor: async () => {
      if (task === undefined) return;
      const file = join(tmpdir(), `tix-${task.shortId}.md`);
      await Bun.write(file, task.description);
      const editor = process.env.VISUAL ?? process.env.EDITOR ?? "vi";
      await renderer.suspend();
      // sh splits an editor command such as "code --wait".
      const run = Bun.spawnSync(["sh", "-c", `${editor} "$1"`, "sh", file], { stdio: ["inherit", "inherit", "inherit"] });
      await renderer.resume();
      const text = await Bun.file(file).text();
      await rm(file, { force: true });
      if (run.exitCode !== 0) return flash(`${editor} stopped with code ${run.exitCode}. The description did not change`, "error");
      if (text === task.description) return flash("The description did not change", "ok");
      act(`Saved the description of ${task.shortId}`, () => live.mutate(api.tasks.update, { id: task.shortId, description: text }));
    },
    block: () => {
      if (item === null) return;
      const current = new Set(task?.blockers.map((blocker) => blocker.shortId));
      const choices = tasks
        .filter((each) => each.shortId !== item.shortId && each.projectKey === item.projectKey && !current.has(each.shortId))
        .map((each) => ({ value: each.shortId, label: each.name, detail: each.shortId, fg: statusColor[statusOf(each)] }));
      setDialog({
        kind: "picker",
        title: `${item.shortId} is blocked by`,
        choices,
        empty: "No other task on the board. Show all tasks with 3, then try again",
        onPick: (blocker) =>
          act(`${blocker} now blocks ${item.shortId}`, () =>
            live.mutate(api.blockers.add, { blocked: item.shortId, blocker }),
          ),
      });
    },
    unblock: () => {
      if (task === undefined) return;
      setDialog({
        kind: "picker",
        title: `Remove a blocker from ${task.shortId}`,
        choices: task.blockers.map((each) => ({ value: each.shortId, label: each.name, detail: each.shortId })),
        empty: "This task has no blockers",
        onPick: (blocker) =>
          act(`${blocker} no longer blocks ${task.shortId}`, () =>
            live.mutate(api.blockers.remove, { blocked: task.shortId, blocker }),
          ),
      });
    },
    remove: () => {
      if (item === null) return;
      const count = descendantCount(tasks, item.shortId);
      setDialog({
        kind: "confirm",
        title: `Delete ${item.shortId}`,
        message: `Delete "${item.name}"${count > 0 ? ` and its ${count} subtask(s)` : ""}? You cannot undo this.`,
        yes: "Delete",
        onYes: () =>
          act(`Deleted ${item.shortId}`, async () => {
            const removed = await live.mutate(api.tasks.remove, { id: item.shortId });
            if (removed.length > 1) flash(`Deleted ${removed.length} tasks`, "ok");
          }),
      });
    },
    copy: () => {
      if (item !== null) copyText(item.shortId, `Copied ${item.shortId}`);
    },
    projects: () => {
      const choices: Choice[] = [
        { value: "", label: "All projects", detail: "every project, grouped" },
        ...(projects.data ?? []).map((project) => ({ value: project.key, label: project.key, detail: `${project.openCount} open` })),
      ];
      setDialog({
        kind: "picker",
        title: "Project",
        choices,
        empty: "No project has this name",
        onPick: (key) => {
          setDialog(null);
          setScope(key === "" ? { kind: "all" } : { kind: "project", key });
          setSelectedId(null);
        },
      });
    },
    filter: (next: ListFilter) => {
      setFilter(next);
      setSelectedId(item?.shortId ?? null);
    },
    /** Changes the query and selects the first task that matches it. */
    find: (next: string) => {
      setQuery(next);
      const needle = next.trim().toLowerCase();
      const found = taskRows(boardRows(tasks, { collapsed, query: next, grouped: scope.kind === "all" })).find((row) =>
        matches(row.task, needle),
      );
      if (found !== undefined) select(found.task.shortId);
    },
    search: () => {
      setFocus("board");
      setSearching(true);
    },
    help: () => setDialog({ kind: "help" }),
  };

  // Keys --------------------------------------------------------------------

  useKeyboard((key: KeyEvent) => {
    if (key.ctrl && key.name === "c") return onQuit();
    if (dialog !== null) return;
    if (searching) {
      if (key.name === "escape") {
        setQuery("");
        setSearching(false);
      } else if (key.name === "return" || key.name === "down") {
        setSearching(false);
      }
      return;
    }
    // Printable keys by their character, so "G" and "?" work on every layout. Tab, enter, and esc keep their names.
    const printable = key.sequence.length === 1 && key.sequence >= " " && key.sequence !== "\x7f";
    const name = printable && !key.ctrl && !key.meta ? key.sequence : key.name;
    if (focus === "ticket") {
      const ticket = ticketRef.current;
      if (name === "j" || name === "down") return ticket?.scrollBy(1);
      if (name === "k" || name === "up") return ticket?.scrollBy(-1);
      if (name === " " || name === "pagedown") return ticket?.scrollBy(Math.max(1, height - 8));
      if (name === "pageup") return ticket?.scrollBy(-Math.max(1, height - 8));
      if (name === "tab" || name === "escape" || name === "h" || name === "left") return setFocus("board");
    }
    const page = Math.max(1, height - 6);
    switch (name) {
      case "q":
        return onQuit();
      case "j":
      case "down":
        return move(1);
      case "k":
      case "up":
        return move(-1);
      case "pagedown":
        return move(page);
      case "pageup":
        return move(-page);
      case "g":
      case "home":
        return move(-selectable.length);
      case "G":
      case "end":
        return move(selectable.length);
      case "h":
      case "left":
        if (selected === null) return;
        if (selected.childCount > 0 && !selected.collapsed) return setCollapsedFor(selected.task.shortId, true);
        if (selected.task.parentShortId !== null) return select(selected.task.parentShortId);
        return;
      case "l":
      case "right":
        if (selected !== null && selected.collapsed) return setCollapsedFor(selected.task.shortId, false);
        return setFocus("ticket");
      case "return":
      case " ":
        if (selected !== null && selected.childCount > 0) return setCollapsedFor(selected.task.shortId, !selected.collapsed);
        return setFocus("ticket");
      case "tab":
        return setFocus("ticket");
      case "escape":
        return setQuery("");
      case "1":
      case "2":
      case "3":
      case "4":
        return actions.filter(FILTERS[Number(name) - 1]);
      case "f":
        return actions.filter(FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length]);
      case "/":
        return actions.search();
      case "p":
        return actions.projects();
      case "s":
        return actions.start();
      case "d":
        return actions.done();
      case "o":
        return actions.reopen();
      case "n":
        return actions.create();
      case "a":
        return actions.subtask();
      case "e":
        return actions.edit();
      case "E":
        return void actions.editor();
      case "b":
        return actions.block();
      case "u":
        return actions.unblock();
      case "x":
        return actions.remove();
      case "y":
        return actions.copy();
      case "?":
        return actions.help();
    }
  });

  // Layout ------------------------------------------------------------------

  const boardEmpty =
    list.error !== null
      ? list.error
      : list.data === undefined
        ? "Loading tasks…"
        : query !== ""
          ? `No task matches "${query}". Press esc to clear the search.`
          : {
              open: "No open tasks. Press n to create one.",
              ready: "No ready tasks. Each open task waits on a blocker.",
              all: "No tasks in this project yet. Press n to create one.",
              closed: "No closed tasks yet.",
            }[filter];

  const showBoard = !narrow || focus === "board";
  const showTicket = !narrow || focus === "ticket";
  const divider = narrow ? -1 : boardWidth;
  const rule = (junction: string) =>
    divider < 0 ? "─".repeat(width) : `${"─".repeat(divider)}${junction}${"─".repeat(Math.max(0, width - divider - 1))}`;

  return (
    <box width={width} height={height} flexDirection="column" backgroundColor={color.platform}>
      <Header
        scope={scope}
        filter={filter}
        tasks={tasks}
        connected={connected}
        compact={width < 130}
        onFilter={actions.filter}
        onProjects={actions.projects}
      />
      <text fg={color.rule} wrapMode="none" flexShrink={0}>
        {rule("┬")}
      </text>
      <box flexGrow={1} minHeight={0} flexDirection="row">
        {showBoard && (
          <Board
            rows={rows}
            selectedId={item?.shortId ?? null}
            focused={focus === "board"}
            width={boardWidth}
            scrollRef={boardRef}
            empty={boardEmpty}
            onSelect={(shortId) => {
              setFocus("board");
              select(shortId);
            }}
            onToggle={(shortId) => setCollapsedFor(shortId, !collapsed.has(shortId))}
          />
        )}
        {showTicket && (
          <box
            flexGrow={1}
            // A border color turns the border on, so the narrow layout sets neither.
            {...(narrow ? {} : { border: ["left"], borderColor: focus === "ticket" ? color.flap : color.rule })}
            onMouseDown={() => setFocus("ticket")}
          >
            <Ticket
              item={item}
              detail={task}
              error={detail.error}
              syntaxStyle={syntaxStyle}
              scrollRef={ticketRef}
              onJump={jump}
            />
          </box>
        )}
      </box>
      <text fg={color.rule} wrapMode="none" flexShrink={0}>
        {rule("┴")}
      </text>
      <Footer
        width={width}
        item={item}
        searching={searching}
        query={query}
        toast={toast}
        onQuery={actions.find}
        actions={actions}
        onQuit={onQuit}
      />
      {dialog?.kind === "help" && <Help onClose={() => setDialog(null)} />}
      {dialog?.kind === "form" && (
        <Form title={dialog.title} fields={dialog.fields} save={dialog.save} onSave={dialog.onSave} onCancel={() => setDialog(null)} />
      )}
      {dialog?.kind === "picker" && (
        <Picker
          title={dialog.title}
          choices={dialog.choices}
          empty={dialog.empty}
          onPick={dialog.onPick}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "confirm" && (
        <Confirm
          title={dialog.title}
          message={dialog.message}
          yes={dialog.yes}
          onYes={dialog.onYes}
          onCancel={() => setDialog(null)}
        />
      )}
    </box>
  );
}

type HeaderProps = {
  scope: Scope;
  filter: ListFilter;
  tasks: TaskListItem[];
  connected: boolean;
  /** Shows the repository name without the host and the owner, and hides the counts. */
  compact: boolean;
  onFilter: (filter: ListFilter) => void;
  onProjects: () => void;
};

function Header({ scope, filter, tasks, connected, compact, onFilter, onProjects }: HeaderProps) {
  const key = scope.kind === "project" && compact ? scope.key.slice(scope.key.lastIndexOf("/") + 1) : scope.kind === "project" ? scope.key : "";
  const slash = key.indexOf("/");
  return (
    <box height={1} flexShrink={0} flexDirection="row" paddingLeft={2} paddingRight={2}>
      <text fg={color.flap} flexShrink={0}>
        <strong>tix</strong>
      </text>
      <box marginLeft={3} flexShrink={0} onMouseDown={onProjects}>
        {scope.kind === "all" ? (
          <text fg={color.chalk}>All projects</text>
        ) : (
          <text wrapMode="none">
            <span fg={color.soot}>{key.slice(0, slash + 1)}</span>
            <span fg={color.chalk}>{key.slice(slash + 1)}</span>
          </text>
        )}
      </box>
      <box flexDirection="row" marginLeft={4} gap={2} flexShrink={0}>
        {FILTERS.map((each) => (
          <box key={each} onMouseDown={() => onFilter(each)}>
            <text fg={each === filter ? color.chalk : color.soot}>
              {each === filter ? (
                <u>
                  <strong>{each}</strong>
                </u>
              ) : (
                each
              )}
            </text>
          </box>
        ))}
      </box>
      <box flexGrow={1} />
      <text wrapMode="none" flexShrink={0}>
        {!compact && statusCounts(tasks).map(([status, count]) => (
          <span key={status} fg={statusColor[status]}>{`${count} ${status}   `}</span>
        ))}
        <span fg={connected ? color.clear : color.signal}>{connected ? "● live" : "○ offline"}</span>
      </text>
    </box>
  );
}

type Actions = {
  start: () => void;
  done: () => void;
  reopen: () => void;
  create: () => void;
  subtask: () => void;
  edit: () => void;
  block: () => void;
  remove: () => void;
  search: () => void;
  projects: () => void;
  help: () => void;
};

type FooterProps = {
  width: number;
  item: TaskListItem | null;
  searching: boolean;
  query: string;
  toast: Toast | null;
  onQuery: (query: string) => void;
  actions: Actions;
  onQuit: () => void;
};

function Footer({ width, item, searching, query, toast, onQuery, actions, onQuit }: FooterProps) {
  const hints: [string, string, () => void][] = [];
  if (item !== null && !item.completed && item.startedAt === null) hints.push(["s", "start", actions.start]);
  if (item !== null && !item.completed) hints.push(["d", "done", actions.done]);
  if (item !== null && item.completed) hints.push(["o", "reopen", actions.reopen]);
  hints.push(["n", "new", actions.create]);
  if (item !== null) {
    hints.push(["a", "subtask", actions.subtask], ["e", "edit", actions.edit], ["b", "block", actions.block], ["x", "delete", actions.remove]);
  }
  hints.push(["/", "find", actions.search], ["p", "project", actions.projects]);

  // "? keys" and "q quit" always show. The other hints show while they fit next to the toast.
  const last: typeof hints = [["?", "keys", actions.help], ["q", "quit", onQuit]];
  const size = ([key, label]: (typeof hints)[number]) => key.length + label.length + 4;
  let used = last.reduce((sum, hint) => sum + size(hint), 0);
  const room = width - 4 - (toast ? Bun.stringWidth(toast.text) + 4 : 0);
  const shown = [
    ...hints.filter((hint) => {
      used += size(hint);
      return used <= room;
    }),
    ...last,
  ];

  return (
    <box height={1} flexShrink={0} flexDirection="row" paddingLeft={2} paddingRight={2}>
      {searching || query !== "" ? (
        <box flexDirection="row" flexGrow={1}>
          <text fg={color.flap} flexShrink={0}>
            {"find  "}
          </text>
          {searching ? (
            <input
              focused
              value={query}
              placeholder="Type a name or a short ID. Enter keeps the result, esc clears it"
              backgroundColor={color.platform}
              focusedBackgroundColor={color.platform}
              textColor={color.chalk}
              placeholderColor={color.soot}
              flexGrow={1}
              onInput={onQuery}
            />
          ) : (
            <text fg={color.chalk}>
              {query}
              <span fg={color.soot}>{"    / change   esc clear"}</span>
            </text>
          )}
        </box>
      ) : (
        <box flexDirection="row" flexGrow={1} gap={3}>
          {shown.map(([key, label, run]) => (
            <box key={key} onMouseDown={run}>
              <text wrapMode="none">
                <span fg={color.flap}>{key}</span>
                <span fg={color.soot}>{` ${label}`}</span>
              </text>
            </box>
          ))}
        </box>
      )}
      {toast !== null && (
        <text fg={toast.tone === "ok" ? color.clear : color.signal} flexShrink={0}>
          {toast.text}
        </text>
      )}
    </box>
  );
}
