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

  it("filters by closed and all, with open tasks first", async () => {
    const { t, token, create } = await setup();
    const done = await create("Done", { priority: 1 });
    await create("Open", { priority: 5 });
    await t.mutation(api.tasks.complete, { token, id: done.shortId });
    const closed = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "closed" });
    expect(closed.map((task) => task.name)).toEqual(["Done"]);
    const all = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "all" });
    expect(all.map((task) => task.name)).toEqual(["Open", "Done"]);
  });

  it("keeps a task out of ready while one of two blockers is open", async () => {
    const { t, token, create } = await setup();
    const first = await create("First");
    const second = await create("Second");
    const waiting = await create("Waiting");
    await t.mutation(api.blockers.add, { token, blocked: waiting.shortId, blocker: first.shortId });
    await t.mutation(api.blockers.add, { token, blocked: waiting.shortId, blocker: second.shortId });
    await t.mutation(api.tasks.complete, { token, id: first.shortId });

    const ready = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "ready" });
    expect(ready.map((task) => task.name)).toEqual(["Second"]);
    const open = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "open" });
    expect(open.find((task) => task.shortId === waiting.shortId)?.blockedBy).toEqual([second.shortId]);
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

  it("leaves out the description", async () => {
    const { t, token, create } = await setup();
    await create("Plan", { description: "Long plan text" });
    const [task] = await t.query(api.tasks.list, { token, projectKey: PROJECT, filter: "open" });
    expect(task.name).toBe("Plan");
    expect(task).not.toHaveProperty("description");
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

  it("returns open and closed tasks of all projects with filter all", async () => {
    const { t, token, create } = await setup();
    const done = await create("Done");
    await create("Theirs", { projectKey: OTHER_PROJECT });
    await t.mutation(api.tasks.complete, { token, id: done.shortId });
    const tasks = await t.query(api.tasks.list, { token, filter: "all", allProjects: true });
    expect(tasks.map((task) => [task.name, task.projectKey])).toEqual([
      ["Theirs", OTHER_PROJECT],
      ["Done", PROJECT],
    ]);
  });

  it("requires projectKey when allProjects is false", async () => {
    const { t, token } = await setup();
    await expectCode(t.query(api.tasks.list, { token, filter: "open" }), "INVALID_INPUT");
  });
});
