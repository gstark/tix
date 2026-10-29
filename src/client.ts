import { ConvexHttpClient } from "convex/browser";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { api } from "../convex/_generated/api.js";
import type { ErrorCode } from "../convex/errors.ts";
import { TixError } from "./errors.ts";

type Args<F extends FunctionReference<"query" | "mutation">> = Omit<FunctionArgs<F>, "token">;

export type TaskView = FunctionReturnType<typeof api.tasks.create>;
export type TaskDetail = FunctionReturnType<typeof api.tasks.get>;
export type TaskListItem = FunctionReturnType<typeof api.tasks.list>[number];
export type TaskSummary = TaskDetail["blockers"][number];
export type ProjectCount = FunctionReturnType<typeof api.projects.list>[number];
export type Commit = NonNullable<TaskView["commit"]>;
export type ListFilter = Args<typeof api.tasks.list>["filter"];

/** The calls that the CLI and the MCP server make. Tests use a fake. */
export interface TixClient {
  createTask(args: Args<typeof api.tasks.create>): Promise<TaskView>;
  getTask(args: Args<typeof api.tasks.get>): Promise<TaskDetail>;
  updateTask(args: Args<typeof api.tasks.update>): Promise<TaskView>;
  startTask(args: Args<typeof api.tasks.start>): Promise<TaskView>;
  completeTask(args: Args<typeof api.tasks.complete>): Promise<TaskView>;
  reopenTask(args: Args<typeof api.tasks.reopen>): Promise<TaskView>;
  removeTask(args: Args<typeof api.tasks.remove>): Promise<string[]>;
  listTasks(args: Args<typeof api.tasks.list>): Promise<TaskListItem[]>;
  addBlocker(args: Args<typeof api.blockers.add>): Promise<TaskView>;
  removeBlocker(args: Args<typeof api.blockers.remove>): Promise<TaskView>;
  listProjects(): Promise<ProjectCount[]>;
}

type ErrorData = { code: ErrorCode; message: string };

function isErrorData(data: unknown): data is ErrorData {
  return typeof data === "object" && data !== null && "code" in data && "message" in data;
}

/** Turns a Convex or fetch error into a TixError. Other errors pass through. */
export function toTixError(error: unknown, url: string): unknown {
  if (error instanceof ConvexError && isErrorData(error.data)) {
    return new TixError(error.data.code, error.data.message);
  }
  // fetch throws a TypeError when it cannot connect.
  if (error instanceof TypeError) return new TixError("NETWORK", `Cannot reach Convex at ${url}`);
  return error;
}

export function convexClient(url: string, token: string): TixClient {
  // logger: false keeps Convex log lines off stdout, which the MCP server uses.
  const http = new ConvexHttpClient(url, { logger: false });
  async function call<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      throw toTixError(error, url);
    }
  }
  return {
    createTask: (args) => call(() => http.mutation(api.tasks.create, { ...args, token })),
    getTask: (args) => call(() => http.query(api.tasks.get, { ...args, token })),
    updateTask: (args) => call(() => http.mutation(api.tasks.update, { ...args, token })),
    startTask: (args) => call(() => http.mutation(api.tasks.start, { ...args, token })),
    completeTask: (args) => call(() => http.mutation(api.tasks.complete, { ...args, token })),
    reopenTask: (args) => call(() => http.mutation(api.tasks.reopen, { ...args, token })),
    removeTask: (args) => call(() => http.mutation(api.tasks.remove, { ...args, token })),
    listTasks: (args) => call(() => http.query(api.tasks.list, { ...args, token })),
    addBlocker: (args) => call(() => http.mutation(api.blockers.add, { ...args, token })),
    removeBlocker: (args) => call(() => http.mutation(api.blockers.remove, { ...args, token })),
    listProjects: () => call(() => http.query(api.projects.list, { token })),
  };
}
