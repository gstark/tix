import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Commit, TixClient } from "../client.ts";
import { TixError } from "../errors.ts";
import type { Git } from "../git.ts";
import { PROJECT, fakeClient, listItem, taskDetail, taskView } from "../test.setup.ts";
import { createMcpServer } from "./server.ts";

const COMMIT: Commit = { sha: "abc1234", branch: "main", message: "fix: parser" };

let close: () => Promise<void> = async () => {};

afterEach(() => close());

/** Connects an MCP client to a server that uses the fakes. */
async function connect(client: TixClient, git: Partial<Git> = {}) {
  const server = createMcpServer({
    cwd: "/work/api",
    git: { remoteUrl: async () => "git@github.com:acme/api.git", commit: async () => null, ...git },
    client: async () => client,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: "test", version: "1.0.0" });
  await mcp.connect(clientTransport);
  close = async () => {
    await mcp.close();
    await server.close();
  };

  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await mcp.callTool({ name, arguments: args });
    const content = result.content as { type: string; text: string }[];
    return { isError: result.isError === true, text: content[0].text };
  };
  return { mcp, call };
}

describe("tix MCP server", () => {
  it("lists the tools", async () => {
    const { mcp } = await connect(fakeClient());
    const { tools } = await mcp.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "create_task",
      "list_tasks",
      "show_task",
      "update_task",
      "manage_blockers",
    ]);
  });

  it("creates a task in the project of the git remote", async () => {
    const createTask = vi.fn<TixClient["createTask"]>(async () => taskView({ shortId: "new11111" }));
    const { call } = await connect(fakeClient({ createTask }));
    const result = await call("create_task", { name: "Fix", description: "Details", priority: 2 });
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text)).toEqual(taskView({ shortId: "new11111" }));
    expect(createTask).toHaveBeenCalledWith({
      projectKey: PROJECT,
      name: "Fix",
      description: "Details",
      priority: 2,
      parent: undefined,
    });
  });

  it("uses the project argument before the git remote", async () => {
    const createTask = vi.fn<TixClient["createTask"]>(async () => taskView());
    const remoteUrl = vi.fn(async () => null);
    const { call } = await connect(fakeClient({ createTask }), { remoteUrl });
    await call("create_task", { name: "Fix", project: "github.com/acme/web" });
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ projectKey: "github.com/acme/web" }));
    expect(remoteUrl).not.toHaveBeenCalled();
  });

  it("returns an error result when there is no project, and keeps running", async () => {
    const listTasks = vi.fn<TixClient["listTasks"]>(async () => []);
    const { call } = await connect(fakeClient({ listTasks }), { remoteUrl: async () => null });
    const failed = await call("list_tasks", {});
    expect(failed).toEqual({
      isError: true,
      text: "No git remote origin in this directory. Use --project <key>",
    });
    expect(await call("list_tasks", { all_projects: true })).toEqual({ isError: false, text: "[]" });
  });

  it("lists tasks with the open filter by default", async () => {
    const items = [listItem({ shortId: "a1" })];
    const listTasks = vi.fn<TixClient["listTasks"]>(async () => items);
    const { call } = await connect(fakeClient({ listTasks }));
    expect(JSON.parse((await call("list_tasks", {})).text)).toEqual(items);
    await call("list_tasks", { filter: "ready" });
    expect(listTasks).toHaveBeenNthCalledWith(1, { filter: "open", projectKey: PROJECT, allProjects: false });
    expect(listTasks).toHaveBeenNthCalledWith(2, { filter: "ready", projectKey: PROJECT, allProjects: false });
  });

  it("shows a task", async () => {
    const getTask = vi.fn<TixClient["getTask"]>(async () => taskDetail({ shortId: "a1" }));
    const { call } = await connect(fakeClient({ getTask }));
    expect(JSON.parse((await call("show_task", { id: "a1" })).text)).toEqual(taskDetail({ shortId: "a1" }));
    expect(getTask).toHaveBeenCalledWith({ id: "a1" });
  });

  it("edits a task and sends parent null to make a root task", async () => {
    const updateTask = vi.fn<TixClient["updateTask"]>(async () => taskView());
    const { call } = await connect(fakeClient({ updateTask }));
    await call("update_task", { action: "edit", id: "a1", name: "New", parent: null });
    expect(updateTask).toHaveBeenCalledWith({
      id: "a1",
      name: "New",
      description: undefined,
      priority: undefined,
      parent: null,
    });
  });

  it("rejects an edit with no fields", async () => {
    const { call } = await connect(fakeClient());
    expect(await call("update_task", { action: "edit", id: "a1" })).toEqual({ isError: true, text: "Nothing to change" });
  });

  it("rejects fields that do not belong to the action", async () => {
    const { call } = await connect(fakeClient());
    expect(await call("update_task", { action: "start", id: "a1", name: "New", result: "x" })).toEqual({
      isError: true,
      text: "name, result cannot be used with action start",
    });
  });

  it.each([
    ["start", "startTask"],
    ["reopen", "reopenTask"],
  ] as const)("runs %s", async (action, method) => {
    const run = vi.fn(async () => taskView({ shortId: "a1" }));
    const { call } = await connect(fakeClient({ [method]: run }));
    expect((await call("update_task", { action, id: "a1" })).isError).toBe(false);
    expect(run).toHaveBeenCalledWith({ id: "a1" });
  });

  it("completes a task with the commit from git", async () => {
    const completeTask = vi.fn<TixClient["completeTask"]>(async () => taskView({ completed: true }));
    const commit = vi.fn(async () => COMMIT);
    const { call } = await connect(fakeClient({ completeTask }), { commit });
    await call("update_task", { action: "complete", id: "a1", result: "Fixed", commit: "HEAD" });
    expect(commit).toHaveBeenCalledWith("/work/api", "HEAD");
    expect(completeTask).toHaveBeenCalledWith({ id: "a1", result: "Fixed", commit: COMMIT });
  });

  it("rejects a ref that is not a commit", async () => {
    const { call } = await connect(fakeClient());
    expect(await call("update_task", { action: "complete", id: "a1", commit: "nope" })).toEqual({
      isError: true,
      text: "nope is not a commit in /work/api",
    });
  });

  it("deletes a task and returns the deleted IDs", async () => {
    const removeTask = vi.fn<TixClient["removeTask"]>(async () => ["a1", "c1"]);
    const { call } = await connect(fakeClient({ removeTask }));
    expect(JSON.parse((await call("update_task", { action: "delete", id: "a1" })).text)).toEqual({
      deleted: ["a1", "c1"],
    });
  });

  it("adds and removes blockers", async () => {
    const addBlocker = vi.fn<TixClient["addBlocker"]>(async () => taskView({ blockedBy: ["b1"] }));
    const removeBlocker = vi.fn<TixClient["removeBlocker"]>(async () => taskView());
    const { call } = await connect(fakeClient({ addBlocker, removeBlocker }));
    await call("manage_blockers", { action: "add", id: "a1", blocker: "b1" });
    await call("manage_blockers", { action: "remove", id: "a1", blocker: "b1" });
    expect(addBlocker).toHaveBeenCalledWith({ blocked: "a1", blocker: "b1" });
    expect(removeBlocker).toHaveBeenCalledWith({ blocked: "a1", blocker: "b1" });
  });

  it("returns server errors as error results", async () => {
    const getTask = vi.fn(async () => {
      throw new TixError("NOT_FOUND", "Task zz not found");
    });
    const { call } = await connect(fakeClient({ getTask }));
    expect(await call("show_task", { id: "zz" })).toEqual({ isError: true, text: "Task zz not found" });
  });

  it("returns invalid arguments as error results", async () => {
    const { call } = await connect(fakeClient());
    const result = await call("update_task", { action: "archive", id: "a1" });
    expect(result.isError).toBe(true);
  });
});
