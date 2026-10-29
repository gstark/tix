import { describe, expect, it } from "vitest";
import { parsePlan } from "./plan.ts";

describe("parsePlan", () => {
  it("uses the first # heading as the name and the full file as the description", () => {
    const content = "Intro\n\n# Parser rewrite\n\n## Steps\n\n# Second heading\n";
    expect(parsePlan(content, "docs/plan.md")).toEqual({ name: "Parser rewrite", description: content });
  });

  it("removes a Plan: prefix and ignores case", () => {
    expect(parsePlan("# PLAN:  Parser rewrite\n", "plan.md").name).toBe("Parser rewrite");
  });

  it("does not use a ## heading", () => {
    expect(parsePlan("## Steps\n", "docs/parser-rewrite.md").name).toBe("parser-rewrite");
  });

  it("uses the file name without .md when there is no heading", () => {
    expect(parsePlan("Some text\n", "/tmp/parser-rewrite.md").name).toBe("parser-rewrite");
  });

  it("fails with USAGE for an empty file", () => {
    expect(() => parsePlan(" \n\t\n", "plan.md")).toThrow(expect.objectContaining({ code: "USAGE" }));
  });
});
