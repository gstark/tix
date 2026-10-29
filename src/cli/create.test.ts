import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TixClient } from "../client.ts";
import { PROJECT, fakeClient, runCli, taskDetail, taskView } from "../test.setup.ts";

function creating() {
  const createTask = vi.fn<TixClient["createTask"]>(async () => taskView({ shortId: "new11111" }));
  return { createTask, client: fakeClient({ createTask }) };
}

describe("tix create", () => {
  it("creates a task and prints the short ID", async () => {
    const { createTask, client } = creating();
    const result = await runCli(["create", "Fix parser", "-d", "Details", "-p", "2", "--parent", "e1"], { client });
    expect(result).toEqual({ code: 0, out: "new11111", err: "" });
    expect(createTask).toHaveBeenCalledWith({
      projectKey: PROJECT,
      name: "Fix parser",
      description: "Details",
      priority: 2,
      parent: "e1",
    });
  });

  it("leaves out options that are not given", async () => {
    const { createTask, client } = creating();
    await runCli(["create", "Fix parser"], { client });
    expect(createTask).toHaveBeenCalledWith({
      projectKey: PROJECT,
      name: "Fix parser",
      description: undefined,
      priority: undefined,
      parent: undefined,
    });
  });

  it("rejects a priority that is not an integer", async () => {
    expect(await runCli(["create", "Fix", "-p", "high"])).toMatchObject({ code: 1 });
  });

  it("requires exactly one name", async () => {
    expect(await runCli(["create"])).toMatchObject({ code: 1, err: "Error: Expected one <name> argument" });
    expect(await runCli(["create", "a", "b"])).toMatchObject({ code: 1 });
  });

  it("prints the full task with --json", async () => {
    const { out } = await runCli(["create", "Fix", "--json"], { client: creating().client });
    expect(JSON.parse(out)).toEqual(taskView({ shortId: "new11111" }));
  });
});

describe("tix show", () => {
  it("prints the task detail", async () => {
    const getTask = vi.fn<TixClient["getTask"]>(async () => taskDetail({ shortId: "a1", name: "Fix" }));
    const { code, out } = await runCli(["show", "a1"], { client: fakeClient({ getTask }) });
    expect(code).toBe(0);
    expect(out.split("\n")[0]).toBe("[ ] a1: Fix");
    expect(getTask).toHaveBeenCalledWith({ id: "a1" });
  });
});

describe("tix plan", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tix-plan-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates one task from the file, relative to the working directory", async () => {
    const content = "# Plan: Parser rewrite\n\n## Steps\n";
    writeFileSync(join(dir, "plan.md"), content);
    const { createTask, client } = creating();
    expect(await runCli(["plan", "plan.md"], { client, cwd: dir })).toMatchObject({ code: 0, out: "new11111" });
    expect(createTask).toHaveBeenCalledWith({ projectKey: PROJECT, name: "Parser rewrite", description: content });
    expect(readFileSync(join(dir, "plan.md"), "utf8")).toBe(content);
  });

  it("fails with exit code 1 for a missing or empty file", async () => {
    writeFileSync(join(dir, "empty.md"), "\n");
    expect(await runCli(["plan", "missing.md"], { cwd: dir })).toMatchObject({ code: 1, err: "Error: Cannot read missing.md" });
    expect(await runCli(["plan", "empty.md"], { cwd: dir })).toMatchObject({ code: 1 });
  });
});
