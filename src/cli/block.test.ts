import { describe, expect, it, vi } from "vitest";
import type { TixClient } from "../client.ts";
import { fakeClient, runCli, taskView } from "../test.setup.ts";

describe("tix block and tix unblock", () => {
  it("adds a blocker and prints the task line", async () => {
    const addBlocker = vi.fn<TixClient["addBlocker"]>(async () => taskView({ shortId: "a1", blockedBy: ["b1"] }));
    expect(await runCli(["block", "a1", "--by", "b1"], { client: fakeClient({ addBlocker }) })).toEqual({
      code: 0,
      out: "[ ] a1 [B: b1]: Task",
      err: "",
    });
    expect(addBlocker).toHaveBeenCalledWith({ blocked: "a1", blocker: "b1" });
  });

  it("removes a blocker", async () => {
    const removeBlocker = vi.fn<TixClient["removeBlocker"]>(async () => taskView({ shortId: "a1" }));
    expect((await runCli(["unblock", "a1", "--by", "b1"], { client: fakeClient({ removeBlocker }) })).out).toBe(
      "[ ] a1: Task",
    );
    expect(removeBlocker).toHaveBeenCalledWith({ blocked: "a1", blocker: "b1" });
  });

  it.each(["block", "unblock"])("%s requires --by", async (name) => {
    expect(await runCli([name, "a1"])).toMatchObject({ code: 1, err: "Error: --by is required" });
  });
});
