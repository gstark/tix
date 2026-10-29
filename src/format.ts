import { styleText } from "node:util";
import type { ProjectCount, TaskDetail, TaskListItem, TaskSummary } from "./client.ts";

// styleText adds no color when stdout is not a terminal or NO_COLOR is set.
const dim = (text: string) => styleText("dim", text);
const bold = (text: string) => styleText("bold", text);

function icon(completed: boolean, started: boolean): string {
  if (completed) return styleText("green", "[x]");
  if (started) return styleText("blue", "[>]");
  return styleText("yellow", "[ ]");
}

/** One task on one line: status, short ID, priority if not 1, open blockers, name. */
export function formatLine(task: TaskListItem, prefix = ""): string {
  const priority = task.priority === 1 ? "" : ` ${styleText("cyan", `[p${task.priority}]`)}`;
  const count = task.blockedBy.length;
  const blocked = count === 0 ? "" : ` ${styleText("red", `[B: ${count === 1 ? task.blockedBy[0] : count}]`)}`;
  return `${prefix}${icon(task.completed, task.startedAt !== null)} ${bold(task.shortId)}${priority}${blocked}: ${task.name}`;
}

function formatSummary(task: TaskSummary): string {
  return `${icon(task.completed, false)} ${bold(task.shortId)}: ${task.name}`;
}

/**
 * Draws the list as a tree. The order of the input is kept. A task whose parent
 * is not in the list is a root, with a note that names the parent.
 */
export function formatTree(tasks: TaskListItem[]): string[] {
  const listed = new Set(tasks.map((task) => task.shortId));
  const children = new Map<string, TaskListItem[]>();
  const roots: TaskListItem[] = [];
  for (const task of tasks) {
    const parent = task.parentShortId;
    if (parent === null || !listed.has(parent)) {
      roots.push(task);
    } else {
      children.set(parent, [...(children.get(parent) ?? []), task]);
    }
  }

  const lines: string[] = [];
  const walk = (task: TaskListItem, prefix: string, childPrefix: string) => {
    const orphan = task.parentShortId !== null && !listed.has(task.parentShortId);
    lines.push(formatLine(task, prefix) + (orphan ? dim(` (under ${task.parentShortId})`) : ""));
    const kids = children.get(task.shortId) ?? [];
    kids.forEach((kid, index) => {
      const last = index === kids.length - 1;
      walk(kid, childPrefix + (last ? "└── " : "├── "), childPrefix + (last ? "    " : "│   "));
    });
  };
  for (const root of roots) walk(root, "", "");
  return lines;
}

/** One tree for each project, sorted by project key. */
export function formatGroups(tasks: TaskListItem[]): string[] {
  const groups = new Map<string, TaskListItem[]>();
  for (const task of tasks) groups.set(task.projectKey, [...(groups.get(task.projectKey) ?? []), task]);
  const lines: string[] = [];
  for (const key of [...groups.keys()].sort()) {
    if (lines.length > 0) lines.push("");
    lines.push(bold(key));
    lines.push(...formatTree(groups.get(key)!).map((line) => `  ${line}`));
  }
  return lines;
}

function field(label: string, value: string): string {
  return `${dim(`${label}:`.padEnd(12))}${value.replace(/\n/g, `\n${" ".repeat(12)}`)}`;
}

function time(ms: number): string {
  return new Date(ms).toISOString();
}

/** All fields of one task, then its subtasks and blockers. */
export function formatDetail(task: TaskDetail): string[] {
  const lines = [formatLine(task), field("Project", task.projectKey)];
  if (task.parentShortId !== null) lines.push(field("Parent", task.parentShortId));
  lines.push(field("Created", time(task.createdAt)));
  if (task.startedAt !== null) lines.push(field("Started", time(task.startedAt)));
  if (task.completedAt !== null) lines.push(field("Completed", time(task.completedAt)));
  if (task.result !== null) lines.push(field("Result", task.result));
  if (task.commit !== null) {
    const { sha, branch, message } = task.commit;
    lines.push(field("Commit", [sha, branch && `(${branch})`, message].filter(Boolean).join(" ")));
  }
  if (task.description !== "") {
    lines.push("", bold("Description"), ...task.description.split("\n").map((line) => `  ${line}`));
  }
  const sections: [string, string[]][] = [
    ["Subtasks", task.children.map((child) => formatLine(child))],
    ["Blocked by", task.blockers.map(formatSummary)],
    ["Blocks", task.blocks.map(formatSummary)],
  ];
  for (const [title, items] of sections) {
    if (items.length > 0) lines.push("", bold(title), ...items.map((item) => `  ${item}`));
  }
  return lines;
}

export function formatProjects(projects: ProjectCount[]): string[] {
  const width = Math.max(0, ...projects.map((project) => project.key.length));
  return projects.map((project) => `${project.key.padEnd(width)}  ${project.openCount} open`);
}
