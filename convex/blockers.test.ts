import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { OTHER_PROJECT, expectCode, setup } from "./test.setup";

describe("blockers.add", () => {
  it("records the blocker in both directions", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    const b = await create("B");
    const blocked = await t.mutation(api.blockers.add, { token, blocked: b.shortId, blocker: a.shortId });
    expect(blocked.blockedBy).toEqual([a.shortId]);

    const viewB = await t.query(api.tasks.get, { token, id: b.shortId });
    expect(viewB.blockers).toEqual([{ shortId: a.shortId, name: "A", completed: false }]);
    const viewA = await t.query(api.tasks.get, { token, id: a.shortId });
    expect(viewA.blocks).toEqual([{ shortId: b.shortId, name: "B", completed: false }]);
  });

  it("stores one row when it adds the same pair twice", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    const b = await create("B");
    await t.mutation(api.blockers.add, { token, blocked: b.shortId, blocker: a.shortId });
    await t.mutation(api.blockers.add, { token, blocked: b.shortId, blocker: a.shortId });
    const rows = await t.run((ctx) => ctx.db.query("blockers").collect());
    expect(rows).toHaveLength(1);
  });

  it("drops a closed blocker from blockedBy", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    const b = await create("B");
    await t.mutation(api.blockers.add, { token, blocked: b.shortId, blocker: a.shortId });
    await t.mutation(api.tasks.complete, { token, id: a.shortId });
    const viewB = await t.query(api.tasks.get, { token, id: b.shortId });
    expect(viewB.blockedBy).toEqual([]);
    expect(viewB.blockers).toEqual([{ shortId: a.shortId, name: "A", completed: true }]);
  });

  it("rejects a task that blocks itself", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    await expectCode(t.mutation(api.blockers.add, { token, blocked: a.shortId, blocker: a.shortId }), "BLOCKER_CYCLE");
  });

  it("rejects a direct cycle", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    const b = await create("B");
    await t.mutation(api.blockers.add, { token, blocked: b.shortId, blocker: a.shortId });
    await expectCode(t.mutation(api.blockers.add, { token, blocked: a.shortId, blocker: b.shortId }), "BLOCKER_CYCLE");
  });

  it("rejects an indirect cycle", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    const b = await create("B");
    const c = await create("C");
    await t.mutation(api.blockers.add, { token, blocked: b.shortId, blocker: a.shortId });
    await t.mutation(api.blockers.add, { token, blocked: c.shortId, blocker: b.shortId });
    await expectCode(t.mutation(api.blockers.add, { token, blocked: a.shortId, blocker: c.shortId }), "BLOCKER_CYCLE");
  });

  it("rejects a blocker in a different project", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    const other = await create("B", { projectKey: OTHER_PROJECT });
    await expectCode(t.mutation(api.blockers.add, { token, blocked: a.shortId, blocker: other.shortId }), "CROSS_PROJECT");
  });

  it("throws NOT_FOUND for an unknown task", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    await expectCode(t.mutation(api.blockers.add, { token, blocked: a.shortId, blocker: "zzzzzzzz" }), "NOT_FOUND");
  });
});

describe("blockers.remove", () => {
  it("removes the row", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    const b = await create("B");
    await t.mutation(api.blockers.add, { token, blocked: b.shortId, blocker: a.shortId });
    const unblocked = await t.mutation(api.blockers.remove, { token, blocked: b.shortId, blocker: a.shortId });
    expect(unblocked.blockedBy).toEqual([]);
    const rows = await t.run((ctx) => ctx.db.query("blockers").collect());
    expect(rows).toHaveLength(0);
  });

  it("throws NOT_FOUND when the pair does not exist", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    const b = await create("B");
    await expectCode(t.mutation(api.blockers.remove, { token, blocked: b.shortId, blocker: a.shortId }), "NOT_FOUND");
  });
});
