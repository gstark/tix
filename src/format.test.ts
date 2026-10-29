import { stripVTControlCharacters } from "node:util";
import { describe, expect, it } from "vitest";
import { formatDetail, formatGroups, formatLine, formatProjects, formatTree } from "./format.ts";
import { listItem, taskDetail, taskView } from "./test.setup.ts";

/** Removes colors, so a test does not depend on the terminal. */
const plain = (lines: string[]) => lines.map((line) => stripVTControlCharacters(line));

describe("formatLine", () => {
  it("shows status, ID, and name, and leaves out priority 1", () => {
    expect(plain([formatLine(listItem({ shortId: "a1", name: "Fix" }))])).toEqual(["[ ] a1: Fix"]);
  });

  it("shows started, closed, priority, and blockers", () => {
    const lines = [
      formatLine(listItem({ shortId: "a1", startedAt: 1, priority: 3, blockedBy: ["b1"] })),
      formatLine(listItem({ shortId: "a2", completed: true, blockedBy: ["b1", "b2"] })),
    ];
    expect(plain(lines)).toEqual(["[>] a1 [p3] [B: b1]: Task", "[x] a2 [B: 2]: Task"]);
  });
});

describe("formatTree", () => {
  it("nests children under their parent and keeps the input order", () => {
    const lines = formatTree([
      listItem({ shortId: "e1", name: "Epic" }),
      listItem({ shortId: "t1", name: "First", parentShortId: "e1" }),
      listItem({ shortId: "s1", name: "Sub", parentShortId: "t1" }),
      listItem({ shortId: "t2", name: "Second", parentShortId: "e1" }),
      listItem({ shortId: "r2", name: "Other root" }),
    ]);
    expect(plain(lines)).toEqual([
      "[ ] e1: Epic",
      "├── [ ] t1: First",
      "│   └── [ ] s1: Sub",
      "└── [ ] t2: Second",
      "[ ] r2: Other root",
    ]);
  });

  it("shows a task whose parent is not listed as a root with a note", () => {
    const lines = formatTree([listItem({ shortId: "t1", parentShortId: "gone" })]);
    expect(plain(lines)).toEqual(["[ ] t1: Task (under gone)"]);
  });

  it("returns no lines for no tasks", () => {
    expect(formatTree([])).toEqual([]);
  });
});

describe("formatGroups", () => {
  it("draws one tree for each project, sorted by key", () => {
    const lines = formatGroups([
      listItem({ shortId: "w1", projectKey: "github.com/acme/web" }),
      listItem({ shortId: "a1", projectKey: "github.com/acme/api" }),
      listItem({ shortId: "a2", projectKey: "github.com/acme/api", parentShortId: "a1" }),
    ]);
    expect(plain(lines)).toEqual([
      "github.com/acme/api",
      "  [ ] a1: Task",
      "  └── [ ] a2: Task",
      "",
      "github.com/acme/web",
      "  [ ] w1: Task",
    ]);
  });
});

describe("formatDetail", () => {
  it("shows the fields, the description, subtasks, and blockers", () => {
    const lines = formatDetail(
      taskDetail({
        shortId: "t1",
        name: "Parser",
        parentShortId: "e1",
        description: "Line one\nLine two",
        completed: true,
        completedAt: Date.UTC(2026, 9, 30),
        result: "Done",
        commit: { sha: "abc1234", branch: "main", message: "fix: parser" },
        children: [taskView({ shortId: "s1", name: "Sub" })],
        blockers: [{ shortId: "b1", name: "Blocker", completed: true }],
        blocks: [{ shortId: "w1", name: "Waiting", completed: false }],
      }),
    );
    expect(plain(lines)).toEqual([
      "[x] t1: Parser",
      "Project:    github.com/acme/api",
      "Parent:     e1",
      "Created:    2026-10-29T12:00:00.000Z",
      "Completed:  2026-10-30T00:00:00.000Z",
      "Result:     Done",
      "Commit:     abc1234 (main) fix: parser",
      "",
      "Description",
      "  Line one",
      "  Line two",
      "",
      "Subtasks",
      "  [ ] s1: Sub",
      "",
      "Blocked by",
      "  [x] b1: Blocker",
      "",
      "Blocks",
      "  [ ] w1: Waiting",
    ]);
  });

  it("indents the next lines of a multi-line result", () => {
    const lines = plain(formatDetail(taskDetail({ result: "One\nTwo" })));
    expect(lines).toContain("Result:     One\n            Two");
  });

  it("leaves out empty fields and sections", () => {
    expect(plain(formatDetail(taskDetail({ shortId: "t1" })))).toEqual([
      "[ ] t1: Task",
      "Project:    github.com/acme/api",
      "Created:    2026-10-29T12:00:00.000Z",
    ]);
  });
});

describe("formatProjects", () => {
  it("aligns the counts", () => {
    expect(
      formatProjects([
        { key: "github.com/acme/api", openCount: 2 },
        { key: "gitlab.com/x/y", openCount: 0 },
      ]),
    ).toEqual(["github.com/acme/api  2 open", "gitlab.com/x/y       0 open"]);
  });
});
