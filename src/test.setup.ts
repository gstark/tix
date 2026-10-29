import type { TaskDetail, TaskListItem, TaskView } from "./client.ts";

export const PROJECT = "github.com/acme/api";

/** A task view with defaults. A test sets only the fields that it checks. */
export function taskView(fields: Partial<TaskView> = {}): TaskView {
  return {
    shortId: "aaaa1111",
    projectKey: PROJECT,
    parentShortId: null,
    name: "Task",
    description: "",
    priority: 1,
    completed: false,
    result: null,
    startedAt: null,
    completedAt: null,
    commit: null,
    createdAt: Date.UTC(2026, 9, 29, 12, 0, 0),
    blockedBy: [],
    ...fields,
  };
}

/** A list item: a task view without the description. */
export function listItem(fields: Partial<TaskListItem> = {}): TaskListItem {
  const { description: _description, ...item } = taskView(fields);
  return item;
}

export function taskDetail(fields: Partial<TaskDetail> = {}): TaskDetail {
  return { ...taskView(fields), children: [], blockers: [], blocks: [], ...fields };
}
