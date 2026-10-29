import { stripVTControlCharacters } from "node:util";
import type { Env } from "./cli/command.ts";
import { main } from "./cli/main.ts";
import type { TaskDetail, TaskListItem, TaskView, TixClient } from "./client.ts";
import type { Git } from "./git.ts";

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

/**
 * A client where each method fails unless the test gives it.
 * A test passes vi.fn() methods to check the arguments.
 */
export function fakeClient(methods: Partial<TixClient> = {}): TixClient {
  const unexpected = (name: string) => () => Promise.reject(new Error(`Unexpected client call: ${name}`));
  return {
    createTask: unexpected("createTask"),
    getTask: unexpected("getTask"),
    updateTask: unexpected("updateTask"),
    startTask: unexpected("startTask"),
    completeTask: unexpected("completeTask"),
    reopenTask: unexpected("reopenTask"),
    removeTask: unexpected("removeTask"),
    listTasks: unexpected("listTasks"),
    addBlocker: unexpected("addBlocker"),
    removeBlocker: unexpected("removeBlocker"),
    listProjects: unexpected("listProjects"),
    ...methods,
  };
}

type RunOptions = { client?: TixClient; git?: Partial<Git>; cwd?: string; env?: Env };

/** Runs the CLI with fakes. `out` and `err` have no colors. */
export async function runCli(argv: string[], options: RunOptions = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, {
    cwd: options.cwd ?? "/work/api",
    env: options.env ?? {},
    git: {
      remoteUrl: async () => "git@github.com:acme/api.git",
      commit: async () => null,
      ...options.git,
    },
    client: async () => options.client ?? fakeClient(),
    out: (text) => out.push(stripVTControlCharacters(text)),
    err: (text) => err.push(stripVTControlCharacters(text)),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}
