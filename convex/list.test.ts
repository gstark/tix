import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { OTHER_PROJECT, PROJECT, expectCode, setup } from "./test.setup";

describe("tasks.list", () => {
  it("returns open tasks in priority order", async () => {
    const { t, token, create } = await setup();
    await create("Three", { priority: 3 });
    await create("One", { priority: 1 });
    await create("Two", { priority: 2 });
    const tasks = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "open" });
    expect(tasks.map((task) => task.name)).toEqual(["One", "Two", "Three"]);
  });

  it("filters by closed and all", async () => {
    const { t, token, create } = await setup();
    const done = await create("Done");
    await create("Open");
    await t.mutation(api.tasks.complete, { token, id: done.shortId });
    const closed = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "closed" });
    expect(closed.map((task) => task.name)).toEqual(["Done"]);
    const all = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "all" });
    expect(all.map((task) => task.name).sort()).toEqual(["Done", "Open"]);
  });

  it("returns ready tasks: open and not blocked by an open task", async () => {
    const { t, token, create } = await setup();
    const blocker = await create("Blocker");
    const waiting = await create("Waiting");
    await t.mutation(api.blockers.add, { token, blocked: waiting.shortId, blocker: blocker.shortId });

    const before = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "ready" });
    expect(before.map((task) => task.name)).toEqual(["Blocker"]);

    await t.mutation(api.tasks.complete, { token, id: blocker.shortId });
    const after = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "ready" });
    expect(after.map((task) => task.name)).toEqual(["Waiting"]);
  });

  it("includes parentShortId and blockedBy", async () => {
    const { t, token, create } = await setup();
    const epic = await create("Epic");
    const child = await create("Child", { parent: epic.shortId });
    await t.mutation(api.blockers.add, { token, blocked: child.shortId, blocker: epic.shortId });
    const tasks = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "open" });
    const listedChild = tasks.find((task) => task.shortId === child.shortId);
    expect(listedChild).toMatchObject({ parentShortId: epic.shortId, blockedBy: [epic.shortId] });
  });

  it("returns only tasks of the given project", async () => {
    const { t, token, create } = await setup();
    await create("Mine");
    await create("Theirs", { projectKey: OTHER_PROJECT });
    const tasks = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "open" });
    expect(tasks.map((task) => task.name)).toEqual(["Mine"]);
  });

  it("returns an empty list for an unknown project", async () => {
    const { t, token } = await setup();
    const tasks = await t.query(api.tasks.list, { token, projectKey: "github.com/acme/none", filter: "open" });
    expect(tasks).toEqual([]);
  });

  it("returns tasks of all projects with their project keys", async () => {
    const { t, token, create } = await setup();
    await create("Mine");
    await create("Theirs", { projectKey: OTHER_PROJECT });
    const tasks = await t.query(api.tasks.list, { token, filter: "open", allProjects: true });
    expect(tasks.map((task) => [task.name, task.projectKey]).sort()).toEqual([
      ["Mine", PROJECT],
      ["Theirs", OTHER_PROJECT],
    ]);
  });

  it("requires projectKey when allProjects is false", async () => {
    const { t, token } = await setup();
    await expectCode(t.query(api.tasks.list, { token, filter: "open" }), "INVALID_INPUT");
  });
});
