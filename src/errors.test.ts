import { describe, expect, it } from "vitest";
import { exitCodeOf } from "./errors.ts";

describe("exitCodeOf", () => {
  it.each([
    ["NOT_FOUND", 1],
    ["MAX_DEPTH", 1],
    ["USAGE", 1],
    ["UNAUTHORIZED", 2],
    ["CONFIG", 2],
    ["NETWORK", 3],
  ] as const)("maps %s to %i", (code, exit) => {
    expect(exitCodeOf(code)).toBe(exit);
  });
});
