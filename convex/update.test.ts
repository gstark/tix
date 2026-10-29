import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { OTHER_PROJECT, expectCode, setup } from "./test.setup";

describe("tasks.update", () => {
  it("changes the name, description, and priority", async () => {
    const { t, token, create } = await setup();
    const task = await create("Old", { description: "old text", priority: 5 });
    const updated = await t.mutation(api.tasks.update, {
      token,
      id: task.shortId,
      name: "New",
      description: "new text",
      priority: 0,
    });
    expect(updated).toMatchObject({ name: "New", description: "new text", priority: 0 });
  });

  it("keeps fields that the call does not include", async () => {
    const { t, token, create } = await setup();
    const task = await create("Keep", { description: "text", priority: 7 });
    const updated = await t.mutation(api.tasks.update, { token, id: task.shortId, name: "Renamed" });
    expect(updated).toMatchObject({ name: "Renamed", description: "text", priority: 7 });
  });

  it("rejects out-of-range fields", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    await expectCode(t.mutation(api.tasks.update, { token, id: task.shortId, name: "" }), "INVALID_INPUT");
    await expectCode(t.mutation(api.tasks.update, { token, id: task.shortId, priority: 101 }), "INVALID_INPUT");
  });

  it("sets and removes the parent", async () => {
    const { t, token, create } = await setup();
    const epic = await create("Epic");
    const task = await create("Task");
    const moved = await t.mutation(api.tasks.update, { token, id: task.shortId, parent: epic.shortId });
    expect(moved.parentShortId).toBe(epic.shortId);
    const detached = await t.mutation(api.tasks.update, { token, id: task.shortId, parent: null });
    expect(detached.parentShortId).toBeNull();
  });

  it("rejects the task as its own parent", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    await expectCode(t.mutation(api.tasks.update, { token, id: task.shortId, parent: task.shortId }), "PARENT_CYCLE");
  });

  it("rejects a descendant as the parent", async () => {
    const { t, token, create } = await setup();
    const epic = await create("Epic");
    const child = await create("Child", { parent: epic.shortId });
    await expectCode(t.mutation(api.tasks.update, { token, id: epic.shortId, parent: child.shortId }), "PARENT_CYCLE");
  });

  it("rejects a move that makes the subtree too deep", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    await create("A1", { parent: a.shortId });
    const b = await create("B");
    const b1 = await create("B1", { parent: b.shortId });
    await expectCode(t.mutation(api.tasks.update, { token, id: a.shortId, parent: b1.shortId }), "MAX_DEPTH");
    const moved = await t.mutation(api.tasks.update, { token, id: a.shortId, parent: b.shortId });
    expect(moved.parentShortId).toBe(b.shortId);
  });

  it("rejects a parent in a different project", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    const other = await create("B", { projectKey: OTHER_PROJECT });
    await expectCode(t.mutation(api.tasks.update, { token, id: task.shortId, parent: other.shortId }), "CROSS_PROJECT");
  });

  it("throws NOT_FOUND for an unknown task", async () => {
    const { t, token } = await setup();
    await expectCode(t.mutation(api.tasks.update, { token, id: "zzzzzzzz", name: "A" }), "NOT_FOUND");
  });
});
