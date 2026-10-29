import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { OTHER_PROJECT, PROJECT, expectCode, setup } from "./test.setup";

describe("tasks.create", () => {
  it("creates a task with default values", async () => {
    const { create } = await setup();
    const task = await create("Write parser");
    expect(task).toMatchObject({
      projectKey: PROJECT,
      parentShortId: null,
      name: "Write parser",
      description: "",
      priority: 1,
      completed: false,
      result: null,
      startedAt: null,
      completedAt: null,
      commit: null,
      blockedBy: [],
    });
    expect(task.shortId).toMatch(/^[0-9a-z]{8}$/);
    expect(task.createdAt).toEqual(expect.any(Number));
  });

  it("creates the project row on the first write only", async () => {
    const { t, create } = await setup();
    await create("A");
    await create("B");
    const projects = await t.run((ctx) => ctx.db.query("projects").collect());
    expect(projects.map((project) => project.key)).toEqual([PROJECT]);
  });

  it("requires a valid token", async () => {
    const { t } = await setup();
    await expectCode(
      t.mutation(api.tasks.create, { token: "bad", projectKey: PROJECT, name: "A" }),
      "UNAUTHORIZED",
    );
  });

  it("rejects out-of-range fields", async () => {
    const { create } = await setup();
    await expectCode(create(""), "INVALID_INPUT");
    await expectCode(create("x".repeat(50_001)), "INVALID_INPUT");
    await expectCode(create("A", { description: "x".repeat(50_001) }), "INVALID_INPUT");
    await expectCode(create("A", { priority: -1 }), "INVALID_INPUT");
    await expectCode(create("A", { priority: 101 }), "INVALID_INPUT");
    await expectCode(create("A", { priority: 1.5 }), "INVALID_INPUT");
    await expectCode(create("A", { projectKey: "" }), "INVALID_INPUT");
  });

  it("accepts the range limits", async () => {
    const { create } = await setup();
    await expect(create("x".repeat(50_000), { priority: 0 })).resolves.toBeDefined();
    await expect(create("A", { priority: 100 })).resolves.toBeDefined();
  });

  it("throws NOT_FOUND for an unknown parent", async () => {
    const { create } = await setup();
    await expectCode(create("A", { parent: "zzzzzzzz" }), "NOT_FOUND");
  });

  it("allows 3 levels and rejects a fourth level", async () => {
    const { create } = await setup();
    const epic = await create("Epic");
    const task = await create("Task", { parent: epic.shortId });
    const subtask = await create("Subtask", { parent: task.shortId });
    expect(subtask.parentShortId).toBe(task.shortId);
    await expectCode(create("Too deep", { parent: subtask.shortId }), "MAX_DEPTH");
  });

  it("rejects a parent in a different project", async () => {
    const { create } = await setup();
    const parent = await create("Parent", { projectKey: OTHER_PROJECT });
    await expectCode(create("Child", { parent: parent.shortId }), "CROSS_PROJECT");
  });
});

describe("tasks.get", () => {
  it("returns the task with its children", async () => {
    const { t, token, create } = await setup();
    const epic = await create("Epic");
    const child = await create("Child", { parent: epic.shortId });
    const result = await t.query(api.tasks.get, { token, id: epic.shortId });
    expect(result.name).toBe("Epic");
    expect(result.projectKey).toBe(PROJECT);
    expect(result.children.map((task) => task.shortId)).toEqual([child.shortId]);
    expect(result.blockers).toEqual([]);
    expect(result.blocks).toEqual([]);
  });

  it("throws NOT_FOUND for an unknown task", async () => {
    const { t, token } = await setup();
    await expectCode(t.query(api.tasks.get, { token, id: "zzzzzzzz" }), "NOT_FOUND");
  });
});
