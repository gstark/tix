import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { expectCode, setup } from "./test.setup";

const COMMIT = { sha: "abc1234", branch: "main", message: "fix: parser" };

type TestConvex = Awaited<ReturnType<typeof setup>>["t"];

/** Reads the stored row, so a test does not trust the mutation's return value. */
function stored(t: TestConvex, shortId: string) {
  return t.run((ctx) =>
    ctx.db
      .query("tasks")
      .withIndex("by_shortId", (q) => q.eq("shortId", shortId))
      .unique(),
  );
}

describe("tasks.start", () => {
  it("records startedAt", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    const started = await t.mutation(api.tasks.start, { token, id: task.shortId });
    expect(started.startedAt).toEqual(expect.any(Number));
    expect(await stored(t, task.shortId)).toMatchObject({ startedAt: started.startedAt, completed: false });
  });

  it("keeps the first startedAt on a second start", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    const first = await t.mutation(api.tasks.start, { token, id: task.shortId });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await t.mutation(api.tasks.start, { token, id: task.shortId });
    expect(second.startedAt).toBe(first.startedAt);
    expect((await stored(t, task.shortId))?.startedAt).toBe(first.startedAt);
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
    expect(await stored(t, task.shortId)).toMatchObject({
      completed: true,
      completedAt: done.completedAt,
      result: "Parser done",
      commit: COMMIT,
    });
  });

  it("keeps the first completedAt and updates the result on a second complete", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    const first = await t.mutation(api.tasks.complete, { token, id: task.shortId, result: "Old" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await t.mutation(api.tasks.complete, { token, id: task.shortId, result: "New" });
    expect(await stored(t, task.shortId)).toMatchObject({ completedAt: first.completedAt, result: "New" });
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
    expect((await stored(t, epic.shortId))?.completed).toBe(false);
    await t.mutation(api.tasks.complete, { token, id: child.shortId });
    await t.mutation(api.tasks.complete, { token, id: epic.shortId });
    expect((await stored(t, epic.shortId))?.completed).toBe(true);
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

    const row = await stored(t, task.shortId);
    expect(row).toMatchObject({ completed: false, result: "Done", commit: COMMIT });
    expect(row?.completedAt).toBeUndefined();
  });
});

describe("lifecycle NOT_FOUND", () => {
  it("throws NOT_FOUND for an unknown task", async () => {
    const { t, token } = await setup();
    await expectCode(t.mutation(api.tasks.start, { token, id: "zzzzzzzz" }), "NOT_FOUND");
    await expectCode(t.mutation(api.tasks.complete, { token, id: "zzzzzzzz" }), "NOT_FOUND");
    await expectCode(t.mutation(api.tasks.reopen, { token, id: "zzzzzzzz" }), "NOT_FOUND");
  });
});
