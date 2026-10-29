import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { expectCode, setup } from "./test.setup";

const COMMIT = { sha: "abc1234", branch: "main", message: "fix: parser" };

describe("tasks.start", () => {
  it("records startedAt", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    const started = await t.mutation(api.tasks.start, { token, id: task.shortId });
    expect(started.startedAt).toEqual(expect.any(Number));
    expect(started.completed).toBe(false);
  });

  it("rejects a closed task", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    await t.mutation(api.tasks.complete, { token, id: task.shortId });
    await expectCode(t.mutation(api.tasks.start, { token, id: task.shortId }), "INVALID_INPUT");
  });
});

describe("tasks.complete", () => {
  it("closes the task with a result and a commit", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    const done = await t.mutation(api.tasks.complete, {
      token,
      id: task.shortId,
      result: "Parser done",
      commit: COMMIT,
    });
    expect(done).toMatchObject({ completed: true, result: "Parser done", commit: COMMIT });
    expect(done.completedAt).toEqual(expect.any(Number));
  });

  it("rejects a result that is too long", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    await expectCode(
      t.mutation(api.tasks.complete, { token, id: task.shortId, result: "x".repeat(50_001) }),
      "INVALID_INPUT",
    );
  });

  it("rejects a task with open children", async () => {
    const { t, token, create } = await setup();
    const epic = await create("Epic");
    const child = await create("Child", { parent: epic.shortId });
    await expectCode(t.mutation(api.tasks.complete, { token, id: epic.shortId }), "OPEN_CHILDREN");
    await t.mutation(api.tasks.complete, { token, id: child.shortId });
    const done = await t.mutation(api.tasks.complete, { token, id: epic.shortId });
    expect(done.completed).toBe(true);
  });

  it("rejects a task with an open grandchild under a closed child", async () => {
    const { t, token, create } = await setup();
    const epic = await create("Epic");
    const child = await create("Child", { parent: epic.shortId });
    const grandchild = await create("Grandchild", { parent: child.shortId });
    await t.mutation(api.tasks.complete, { token, id: grandchild.shortId });
    await t.mutation(api.tasks.complete, { token, id: child.shortId });
    await t.mutation(api.tasks.reopen, { token, id: grandchild.shortId });
    await expectCode(t.mutation(api.tasks.complete, { token, id: epic.shortId }), "OPEN_CHILDREN");
  });
});

describe("tasks.reopen", () => {
  it("clears completedAt and keeps result and commit", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    await t.mutation(api.tasks.complete, { token, id: task.shortId, result: "Done", commit: COMMIT });
    const reopened = await t.mutation(api.tasks.reopen, { token, id: task.shortId });
    expect(reopened).toMatchObject({ completed: false, completedAt: null, result: "Done", commit: COMMIT });
  });
});
