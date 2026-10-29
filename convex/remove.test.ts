import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { expectCode, setup } from "./test.setup";

describe("tasks.remove", () => {
  it("deletes the task, its descendants, and their blocker rows", async () => {
    const { t, token, create } = await setup();
    const epic = await create("Epic");
    const child = await create("Child", { parent: epic.shortId });
    const grandchild = await create("Grandchild", { parent: child.shortId });
    const other = await create("Other");
    const outside = await create("Outside");
    await t.mutation(api.blockers.add, { token, blocked: other.shortId, blocker: grandchild.shortId });
    await t.mutation(api.blockers.add, { token, blocked: child.shortId, blocker: outside.shortId });
    await t.mutation(api.blockers.add, { token, blocked: outside.shortId, blocker: other.shortId });

    const deleted = await t.mutation(api.tasks.remove, { token, id: epic.shortId });
    expect(deleted.sort()).toEqual([epic.shortId, child.shortId, grandchild.shortId].sort());

    const tasks = await t.run((ctx) => ctx.db.query("tasks").collect());
    expect(tasks.map((task) => task.shortId).sort()).toEqual([other.shortId, outside.shortId].sort());
    const rows = await t.run((ctx) => ctx.db.query("blockers").collect());
    expect(rows).toHaveLength(1);
    const remaining = await t.query(api.tasks.get, { token, id: outside.shortId });
    expect(remaining.blockers.map((blocker) => blocker.shortId)).toEqual([other.shortId]);
    await expectCode(t.query(api.tasks.get, { token, id: child.shortId }), "NOT_FOUND");
  });

  it("keeps the parent and siblings when it deletes a middle task", async () => {
    const { t, token, create } = await setup();
    const epic = await create("Epic");
    const a = await create("A", { parent: epic.shortId });
    const aChild = await create("A child", { parent: a.shortId });
    const b = await create("B", { parent: epic.shortId });

    const deleted = await t.mutation(api.tasks.remove, { token, id: a.shortId });
    expect(deleted.sort()).toEqual([a.shortId, aChild.shortId].sort());
    const storedEpic = await t.query(api.tasks.get, { token, id: epic.shortId });
    expect(storedEpic.children.map((child) => child.shortId)).toEqual([b.shortId]);
  });

  it("deletes a blocker row only once when both ends are deleted", async () => {
    const { t, token, create } = await setup();
    const epic = await create("Epic");
    const a = await create("A", { parent: epic.shortId });
    const b = await create("B", { parent: epic.shortId });
    await t.mutation(api.blockers.add, { token, blocked: b.shortId, blocker: a.shortId });
    await t.mutation(api.tasks.remove, { token, id: epic.shortId });
    const rows = await t.run((ctx) => ctx.db.query("blockers").collect());
    expect(rows).toHaveLength(0);
  });

  it("throws NOT_FOUND for an unknown task", async () => {
    const { t, token } = await setup();
    await expectCode(t.mutation(api.tasks.remove, { token, id: "zzzzzzzz" }), "NOT_FOUND");
  });
});
