import { describe, expect, it, vi } from "vitest";
import type { TixClient } from "../client.ts";
import { fakeClient, runCli, taskView } from "../test.setup.ts";

function editing() {
  const updateTask = vi.fn<TixClient["updateTask"]>(async () => taskView({ shortId: "a1", name: "New" }));
  return { updateTask, client: fakeClient({ updateTask }) };
}

describe("tix edit", () => {
  it("sends only the given fields and prints the task line", async () => {
    const { updateTask, client } = editing();
    const result = await runCli(["edit", "a1", "--name", "New", "-p", "0"], { client });
    expect(result).toEqual({ code: 0, out: "[ ] a1: New", err: "" });
    expect(updateTask).toHaveBeenCalledWith({
      id: "a1",
      name: "New",
      description: undefined,
      priority: 0,
      parent: undefined,
    });
  });

  it("sends parent null for --no-parent", async () => {
    const { updateTask, client } = editing();
    await runCli(["edit", "a1", "--no-parent"], { client });
    expect(updateTask).toHaveBeenCalledWith(expect.objectContaining({ parent: null }));
  });

  it("rejects --parent with --no-parent", async () => {
    expect(await runCli(["edit", "a1", "--parent", "e1", "--no-parent"])).toMatchObject({
      code: 1,
      err: "Error: Use --parent or --no-parent, not both",
    });
  });

  it("rejects an edit with no fields", async () => {
    expect(await runCli(["edit", "a1"])).toMatchObject({ code: 1, err: "Error: Nothing to change. Run tix help edit" });
  });
});
