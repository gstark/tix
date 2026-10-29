import type { TaskListItem } from "../client.ts";

/** The word on the split-flap status cell. */
export type Status = "open" | "doing" | "wait" | "done";

export function statusOf(task: Pick<TaskListItem, "completed" | "startedAt" | "blockedBy">): Status {
  if (task.completed) return "done";
  if (task.blockedBy.length > 0) return "wait";
  if (task.startedAt !== null) return "doing";
  return "open";
}

export type TaskRow = {
  kind: "task";
  task: TaskListItem;
  /** Tree glyphs in front of the name, for example "│  ├─ ". */
  guides: string;
  /** The number of listed children. */
  childCount: number;
  collapsed: boolean;
};

export type ProjectRow = { kind: "project"; key: string; count: number };

export type Row = TaskRow | ProjectRow;

/**
 * Flattens the tasks into board rows. The order of the input is kept. A task
 * whose parent is not listed is a root. With a query, the board keeps the
 * matching tasks and their listed ancestors, and opens collapsed parents.
 */
export function boardRows(
  tasks: TaskListItem[],
  options: { collapsed: ReadonlySet<string>; query: string; grouped: boolean },
): Row[] {
  const byId = new Map(tasks.map((task) => [task.shortId, task]));
  const kept = matching(tasks, byId, options.query.trim().toLowerCase());
  const children = new Map<string, TaskListItem[]>();
  const roots: TaskListItem[] = [];
  for (const task of tasks) {
    if (!kept.has(task.shortId)) continue;
    const parent = task.parentShortId;
    if (parent === null || !kept.has(parent)) {
      roots.push(task);
    } else {
      children.set(parent, [...(children.get(parent) ?? []), task]);
    }
  }

  const searching = options.query.trim() !== "";
  const walk = (rows: Row[], task: TaskListItem, guides: string, childGuides: string) => {
    const kids = children.get(task.shortId) ?? [];
    const collapsed = !searching && kids.length > 0 && options.collapsed.has(task.shortId);
    rows.push({ kind: "task", task, guides, childCount: kids.length, collapsed });
    if (collapsed) return;
    kids.forEach((kid, index) => {
      const last = index === kids.length - 1;
      walk(rows, kid, childGuides + (last ? "└─ " : "├─ "), childGuides + (last ? "   " : "│  "));
    });
  };

  const rows: Row[] = [];
  if (!options.grouped) {
    for (const root of roots) walk(rows, root, "", "");
    return rows;
  }
  const groups = new Map<string, TaskListItem[]>();
  for (const root of roots) groups.set(root.projectKey, [...(groups.get(root.projectKey) ?? []), root]);
  for (const key of [...groups.keys()].sort()) {
    const count = tasks.filter((task) => task.projectKey === key && kept.has(task.shortId)).length;
    rows.push({ kind: "project", key, count });
    for (const root of groups.get(key)!) walk(rows, root, "", "");
  }
  return rows;
}

/** True when the name holds the lowercase query, or the short ID starts with it. */
export function matches(task: TaskListItem, query: string): boolean {
  return task.name.toLowerCase().includes(query) || task.shortId.startsWith(query);
}

/** The short IDs of the tasks that match the query, with their listed ancestors. */
function matching(tasks: TaskListItem[], byId: Map<string, TaskListItem>, query: string): Set<string> {
  if (query === "") return new Set(byId.keys());
  const kept = new Set<string>();
  for (const task of tasks) {
    if (!matches(task, query)) continue;
    let current: TaskListItem | undefined = task;
    while (current && !kept.has(current.shortId)) {
      kept.add(current.shortId);
      current = current.parentShortId === null ? undefined : byId.get(current.parentShortId);
    }
  }
  return kept;
}

export function taskRows(rows: Row[]): TaskRow[] {
  return rows.filter((row): row is TaskRow => row.kind === "task");
}

/** The counts for the header, one for each status that occurs. */
export function statusCounts(tasks: TaskListItem[]): [Status, number][] {
  const counts = new Map<Status, number>();
  for (const task of tasks) counts.set(statusOf(task), (counts.get(statusOf(task)) ?? 0) + 1);
  return (["doing", "open", "wait", "done"] as const)
    .filter((status) => counts.has(status))
    .map((status) => [status, counts.get(status)!]);
}

/** Cuts the text to `width` terminal columns and adds "…" when it cuts. */
export function truncate(text: string, width: number): string {
  if (width <= 0) return "";
  if (Bun.stringWidth(text) <= width) return text;
  let result = "";
  for (const char of text) {
    if (Bun.stringWidth(result + char) > width - 1) break;
    result += char;
  }
  return `${result}…`;
}
