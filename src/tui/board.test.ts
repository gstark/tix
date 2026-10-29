import { describe, expect, it } from "vitest";
import { listItem } from "../test.setup.ts";
import { boardRows, statusCounts, statusOf, taskRows, truncate } from "./board.ts";
import { flapFrame, flapLength } from "./flap.ts";
import { ago } from "./time.ts";

const epic = listItem({ shortId: "epic0000", name: "Cutover" });
const first = listItem({ shortId: "first000", name: "Assign owners", parentShortId: "epic0000" });
const second = listItem({ shortId: "second00", name: "Release tools", parentShortId: "epic0000", blockedBy: ["first000"] });
const other = listItem({ shortId: "other000", name: "Other", projectKey: "github.com/acme/web" });

const names = (rows: ReturnType<typeof boardRows>) =>
  rows.map((row) => (row.kind === "task" ? `${row.guides}${row.task.name}` : `# ${row.key}`));

describe("statusOf", () => {
  it("puts done before wait, and wait before doing", () => {
    expect(statusOf(listItem({ completed: true, blockedBy: ["x"] }))).toBe("done");
    expect(statusOf(listItem({ startedAt: 1, blockedBy: ["x"] }))).toBe("wait");
    expect(statusOf(listItem({ startedAt: 1 }))).toBe("doing");
    expect(statusOf(listItem())).toBe("open");
  });
});

describe("boardRows", () => {
  const options = { collapsed: new Set<string>(), query: "", grouped: false };

  it("draws the tree with guides", () => {
    expect(names(boardRows([epic, first, second], options))).toEqual([
      "Cutover",
      "├─ Assign owners",
      "└─ Release tools",
    ]);
  });

  it("hides the children of a collapsed task", () => {
    const rows = boardRows([epic, first, second], { ...options, collapsed: new Set(["epic0000"]) });
    expect(names(rows)).toEqual(["Cutover"]);
    expect(rows[0]).toMatchObject({ collapsed: true, childCount: 2 });
  });

  it("keeps the matches and their ancestors, and opens collapsed parents", () => {
    const rows = boardRows([epic, first, second], { ...options, collapsed: new Set(["epic0000"]), query: "release" });
    expect(names(rows)).toEqual(["Cutover", "└─ Release tools"]);
  });

  it("matches the start of a short ID", () => {
    expect(names(boardRows([epic, first, second], { ...options, query: "first" }))).toEqual([
      "Cutover",
      "└─ Assign owners",
    ]);
  });

  it("groups the roots by project, sorted by key", () => {
    const rows = boardRows([other, epic, first], { ...options, grouped: true });
    expect(names(rows)).toEqual(["# github.com/acme/api", "Cutover", "└─ Assign owners", "# github.com/acme/web", "Other"]);
    expect(rows[0]).toMatchObject({ count: 2 });
    expect(taskRows(rows)).toHaveLength(3);
  });
});

describe("statusCounts", () => {
  it("counts each status that occurs", () => {
    expect(statusCounts([epic, first, second])).toEqual([
      ["open", 2],
      ["wait", 1],
    ]);
  });
});

describe("truncate", () => {
  it("cuts to the width and adds an ellipsis", () => {
    expect(truncate("Release tools", 8)).toBe("Release…");
    expect(truncate("Release", 8)).toBe("Release");
    expect(truncate("Release", 0)).toBe("");
  });
});

describe("flapFrame", () => {
  it("turns each letter forward one step for each tick", () => {
    expect(flapFrame("open", "doing", 0)).toBe("open ");
    expect(flapFrame("     ", "done", 1)).toBe("aaaa ");
    expect(flapFrame("open", "doing", flapLength("open", "doing"))).toBe("doing");
  });

  it("passes through the blank to turn backward", () => {
    // "o" to "d" goes o..z, blank, a..d: 16 turns.
    expect(flapLength("o", "d")).toBe(16);
    expect(flapFrame("o", "d", 12)).toBe("     ");
  });
});

describe("ago", () => {
  it("uses the largest unit", () => {
    const now = Date.UTC(2026, 9, 29);
    expect(ago(now - 30_000, now)).toBe("just now");
    expect(ago(now - 5 * 60_000, now)).toBe("5m ago");
    expect(ago(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(ago(now - 2 * 86_400_000, now)).toBe("2d ago");
  });
});
