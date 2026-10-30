import { describe, expect, it } from "vitest";
import { MIN_BOARD, MIN_TICKET, NARROW, clampBoardWidth, resolveBoardWidth } from "./split.ts";

describe("resolveBoardWidth", () => {
  it("uses half of the terminal, from 48 to 96 columns, before a drag", () => {
    expect(resolveBoardWidth(100, null)).toBe(50);
    expect(resolveBoardWidth(120, null)).toBe(60);
    expect(resolveBoardWidth(160, null)).toBe(80);
    expect(resolveBoardWidth(200, null)).toBe(96);
    expect(resolveBoardWidth(240, null)).toBe(96);
  });

  it("gives the whole terminal to one pane when the terminal is narrow", () => {
    expect(resolveBoardWidth(NARROW - 1, 80)).toBe(NARROW - 1);
    expect(resolveBoardWidth(80, null)).toBe(80);
  });

  it("keeps a saved width", () => {
    expect(resolveBoardWidth(160, 70)).toBe(70);
  });

  it("clamps a saved width so the ticket keeps a readable column", () => {
    expect(resolveBoardWidth(160, 10)).toBe(MIN_BOARD);
    expect(resolveBoardWidth(160, 150)).toBe(160 - MIN_TICKET);
    expect(160 - resolveBoardWidth(160, 150)).toBe(MIN_TICKET);
  });
});

describe("clampBoardWidth", () => {
  it("rounds to a whole column", () => {
    expect(clampBoardWidth(160, 70.6)).toBe(71);
  });
});
