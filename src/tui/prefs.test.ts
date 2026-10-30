import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadBoardWidth, saveBoardWidth, uiPath } from "./prefs.ts";

let dir: string;
let env: { TIX_CONFIG: string };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tix-ui-"));
  env = { TIX_CONFIG: join(dir, "nested", "config.toml") };
  mkdirSync(dirname(uiPath(env)), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("uiPath", () => {
  it("uses the directory of TIX_CONFIG", () => {
    expect(uiPath({ TIX_CONFIG: "/x/tix.toml" })).toBe("/x/ui.toml");
  });

  it("defaults to ~/.config/tix/ui.toml", () => {
    expect(uiPath({})).toMatch(/\.config\/tix\/ui\.toml$/);
  });
});

describe("loadBoardWidth", () => {
  it("returns null when the file is missing", async () => {
    expect(await loadBoardWidth(env)).toBeNull();
  });

  it("returns null when the file is not TOML", async () => {
    writeFileSync(uiPath(env), "board_width = ");
    expect(await loadBoardWidth(env)).toBeNull();
  });

  it("returns null when the width is missing or not a whole number", async () => {
    writeFileSync(uiPath(env), "other = 1\n");
    expect(await loadBoardWidth(env)).toBeNull();
    writeFileSync(uiPath(env), 'board_width = "40"\n');
    expect(await loadBoardWidth(env)).toBeNull();
    writeFileSync(uiPath(env), "board_width = 12.5\n");
    expect(await loadBoardWidth(env)).toBeNull();
  });

  it("reads the width that saveBoardWidth writes", async () => {
    await saveBoardWidth(env, 64);
    expect(await loadBoardWidth(env)).toBe(64);
    await saveBoardWidth(env, 80);
    expect(await loadBoardWidth(env)).toBe(80);
  });

  it("creates the directory when it saves", async () => {
    const deep = { TIX_CONFIG: join(dir, "a", "b", "config.toml") };
    await saveBoardWidth(deep, 40);
    expect(await loadBoardWidth(deep)).toBe(40);
  });
});

describe("saveBoardWidth", () => {
  it("rejects a width that is not a whole number of columns", async () => {
    await expect(saveBoardWidth(env, 1.5)).rejects.toThrow(/whole number/);
  });
});
