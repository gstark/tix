import type { ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import type { ReactNode, RefObject } from "react";
import type { TaskDetail, TaskListItem, TaskSummary } from "../client.ts";
import { statusOf } from "./board.ts";
import { Flap } from "./Flap.tsx";
import { color, statusColor } from "./theme.ts";
import { ago } from "./time.ts";

type Props = {
  /** The row from the board. It shows at once, before the detail loads. */
  item: TaskListItem | null;
  detail: TaskDetail | undefined;
  error: string | null;
  syntaxStyle: SyntaxStyle;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  onJump: (shortId: string) => void;
};

export function Ticket({ item, detail, error, syntaxStyle, scrollRef, onJump }: Props) {
  if (item === null) {
    return (
      <box flexGrow={1} paddingLeft={2} paddingTop={1}>
        <text fg={color.soot}>Select a task to see it here.</text>
      </box>
    );
  }
  // The detail of the last task stays until the new one loads. Use it only when it matches.
  const task = detail?.shortId === item.shortId ? detail : undefined;
  const status = statusOf(item);
  const now = Date.now();
  return (
    <scrollbox ref={scrollRef} flexGrow={1} paddingLeft={2} paddingRight={2} scrollbarOptions={{ visible: false }}>
      <box paddingTop={1}>
        <text fg={color.chalk}>
          <strong>{item.name}</strong>
        </text>
      </box>
      <box flexDirection="row" marginTop={1} height={1}>
        <Flap key={item.shortId} word={status} fg={statusColor[status]} />
        <text wrapMode="none">
          <span fg={color.chalk}>{`  ${item.shortId}`}</span>
          <Meta label="priority" value={String(item.priority)} />
          {item.startedAt !== null && <Meta label="started" value={ago(item.startedAt, now)} />}
          {item.completedAt !== null && <Meta label="closed" value={ago(item.completedAt, now)} />}
          <Meta label="created" value={ago(item.createdAt, now)} />
        </text>
      </box>
      {item.parentShortId !== null && (
        <box height={1} onMouseDown={() => onJump(item.parentShortId!)}>
          <text>
            <span fg={color.soot}>{"under "}</span>
            <span fg={color.flap}>
              <u>{item.parentShortId}</u>
            </span>
            {task?.projectKey !== undefined && <span fg={color.soot}>{`  in ${task.projectKey}`}</span>}
          </text>
        </box>
      )}

      {error !== null && (
        <Section title="Cannot load the task">
          <text fg={color.signal}>{error}</text>
        </Section>
      )}

      {task === undefined ? (
        error === null && (
          <box marginTop={1}>
            <text fg={color.soot}>Loading…</text>
          </box>
        )
      ) : (
        <>
          {task.blockers.length > 0 && (
            <Section title="Blocked by">
              <Links tasks={task.blockers} onJump={onJump} />
            </Section>
          )}
          {task.result !== null && task.result !== "" && (
            <Section title="Result">
              <markdown content={task.result} syntaxStyle={syntaxStyle} />
            </Section>
          )}
          {task.commit !== null && (
            <Section title="Commit">
              <text>
                <span fg={color.flap}>{task.commit.sha.slice(0, 10)}</span>
                {task.commit.branch && <span fg={color.soot}>{`  ${task.commit.branch}`}</span>}
                {task.commit.message && <span fg={color.chalk}>{`  ${task.commit.message}`}</span>}
              </text>
            </Section>
          )}
          <Section title="Description">
            {task.description === "" ? (
              <text fg={color.soot}>No description. Press e to write one, or E to write it in your editor.</text>
            ) : (
              <markdown content={task.description} syntaxStyle={syntaxStyle} />
            )}
          </Section>
          {task.children.length > 0 && (
            <Section title={`Subtasks  ${task.children.filter((child) => child.completed).length}/${task.children.length} done`}>
              <Links tasks={task.children} onJump={onJump} />
            </Section>
          )}
          {task.blocks.length > 0 && (
            <Section title="Blocks">
              <Links tasks={task.blocks} onJump={onJump} />
            </Section>
          )}
          <box height={1} />
        </>
      )}
    </scrollbox>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span fg={color.soot}>{`   ${label} `}</span>
      <span fg={color.chalk}>{value}</span>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <box marginTop={1} flexDirection="column">
      <text fg={color.soot}>
        <strong>{title}</strong>
      </text>
      {children}
    </box>
  );
}

type Linkable = TaskSummary | (TaskSummary & Pick<TaskListItem, "startedAt" | "blockedBy">);

/** Tasks that the reader can click to open. */
function Links({ tasks, onJump }: { tasks: Linkable[]; onJump: (shortId: string) => void }) {
  return (
    <box flexDirection="column">
      {tasks.map((task) => {
        const status = "startedAt" in task ? statusOf(task) : task.completed ? "done" : "open";
        return (
          <box key={task.shortId} height={1} onMouseDown={() => onJump(task.shortId)}>
            <text wrapMode="none">
              <span fg={statusColor[status]}>{status.padEnd(6)}</span>
              <span fg={color.flap}>
                <u>{task.shortId}</u>
              </span>
              <span fg={task.completed ? color.soot : color.chalk}>{`  ${task.name}`}</span>
            </text>
          </box>
        );
      })}
    </box>
  );
}
