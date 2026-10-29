import { describe, expect, it, vi } from "vitest";
import type { Commit, TixClient } from "../client.ts";
import { fakeClient, runCli, taskView } from "../test.setup.ts";

const COMMIT: Commit = { sha: "abc1234", branch: "main", message: "fix: parser" };

describe("tix start and tix reopen", () => {
  it("starts a task and prints the task line", async () => {
    const startTask = vi.fn<TixClient["startTask"]>(async () => taskView({ shortId: "a1", startedAt: 1 }));
    expect(await runCli(["start", "a1"], { client: fakeClient({ startTask }) })).toEqual({
      code: 0,
      out: "[>] a1: Task",
      err: "",
    });
    expect(startTask).toHaveBeenCalledWith({ id: "a1" });
  });

  it("reopens a task", async () => {
    const reopenTask = vi.fn<TixClient["reopenTask"]>(async () => taskView({ shortId: "a1" }));
    expect((await runCli(["reopen", "a1"], { client: fakeClient({ reopenTask }) })).out).toBe("[ ] a1: Task");
    expect(reopenTask).toHaveBeenCalledWith({ id: "a1" });
  });
});

describe("tix done", () => {
  it("closes a task with a result and the commit from git", async () => {
    const completeTask = vi.fn<TixClient["completeTask"]>(async () => taskView({ shortId: "a1", completed: true }));
    const commit = vi.fn(async () => COMMIT);
    const result = await runCli(["done", "a1", "-r", "Fixed", "--commit", "HEAD"], {
      client: fakeClient({ completeTask }),
      git: { commit },
    });
    expect(result).toEqual({ code: 0, out: "[x] a1: Task", err: "" });
    expect(commit).toHaveBeenCalledWith("/work/api", "HEAD");
    expect(completeTask).toHaveBeenCalledWith({ id: "a1", result: "Fixed", commit: COMMIT });
  });

  it("does not read git without --commit", async () => {
    const completeTask = vi.fn<TixClient["completeTask"]>(async () => taskView({ completed: true }));
    const commit = vi.fn(async () => COMMIT);
    await runCli(["done", "a1"], { client: fakeClient({ completeTask }), git: { commit } });
    expect(commit).not.toHaveBeenCalled();
    expect(completeTask).toHaveBeenCalledWith({ id: "a1", result: undefined, commit: undefined });
  });

  it("fails with exit code 1 for a ref that is not a commit", async () => {
    expect(await runCli(["done", "a1", "--commit", "nope"])).toEqual({
      code: 1,
      out: "",
      err: "Error: nope is not a commit in /work/api",
    });
  });
});

describe("tix delete", () => {
  it("prints the deleted IDs", async () => {
    const removeTask = vi.fn<TixClient["removeTask"]>(async () => ["a1", "c1"]);
    expect((await runCli(["delete", "a1"], { client: fakeClient({ removeTask }) })).out).toBe(
      "Deleted 2 task(s): a1, c1",
    );
    expect(removeTask).toHaveBeenCalledWith({ id: "a1" });
  });

  it("prints the deleted IDs as JSON", async () => {
    const removeTask = vi.fn<TixClient["removeTask"]>(async () => ["a1"]);
    expect(JSON.parse((await runCli(["delete", "a1", "--json"], { client: fakeClient({ removeTask }) })).out)).toEqual([
      "a1",
    ]);
  });
});
