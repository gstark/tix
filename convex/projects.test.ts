import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { OTHER_PROJECT, PROJECT, setup } from "./test.setup";

describe("projects.list", () => {
  it("returns each key with its count of open tasks, sorted by key", async () => {
    const { t, token, create } = await setup();
    // OTHER_PROJECT first, so creation order differs from key order.
    await create("Other", { projectKey: OTHER_PROJECT });
    await create("Other 2", { projectKey: OTHER_PROJECT });
    await create("Open");
    const done = await create("Done");
    await t.mutation(api.tasks.complete, { token, id: done.shortId });

    const projects = await t.query(api.projects.list, { token });
    expect(projects).toEqual([
      { key: PROJECT, openCount: 1 },
      { key: OTHER_PROJECT, openCount: 2 },
    ]);
  });
});
