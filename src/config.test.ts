import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configPath, loadConfig, saveConfig } from "./config.ts";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tix-config-"));
  path = join(dir, "nested", "config.toml");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("configPath", () => {
  it("uses TIX_CONFIG", () => {
    expect(configPath({ TIX_CONFIG: "/x/tix.toml" })).toBe("/x/tix.toml");
  });

  it("defaults to ~/.config/tix/config.toml", () => {
    expect(configPath({})).toMatch(/\.config\/tix\/config\.toml$/);
  });
});

describe("loadConfig", () => {
  it("reads the file that saveConfig writes", async () => {
    await saveConfig({ TIX_CONFIG: path }, { convexUrl: "https://a.convex.cloud", token: "tix_a" });
    expect(await loadConfig({ TIX_CONFIG: path })).toEqual({ convexUrl: "https://a.convex.cloud", token: "tix_a" });
  });

  it("lets TIX_CONVEX_URL and TIX_TOKEN override the file", async () => {
    await saveConfig({ TIX_CONFIG: path }, { convexUrl: "https://a.convex.cloud", token: "tix_a" });
    const env = { TIX_CONFIG: path, TIX_CONVEX_URL: "https://b.convex.cloud", TIX_TOKEN: "tix_b" };
    expect(await loadConfig(env)).toEqual({ convexUrl: "https://b.convex.cloud", token: "tix_b" });
  });

  it("works with environment variables and no file", async () => {
    const env = { TIX_CONFIG: path, TIX_CONVEX_URL: "https://b.convex.cloud", TIX_TOKEN: "tix_b" };
    expect(await loadConfig(env)).toEqual({ convexUrl: "https://b.convex.cloud", token: "tix_b" });
  });

  it("fails with CONFIG when a value is missing", async () => {
    await expect(loadConfig({ TIX_CONFIG: path, TIX_TOKEN: "tix_b" })).rejects.toMatchObject({
      code: "CONFIG",
      message: expect.stringContaining("tix login"),
    });
  });

  it("fails with CONFIG when the file is not TOML", async () => {
    const bad = join(dir, "bad.toml");
    writeFileSync(bad, "convex_url = ");
    await expect(loadConfig({ TIX_CONFIG: bad })).rejects.toMatchObject({ code: "CONFIG" });
  });
});

describe("saveConfig", () => {
  it("writes the file with mode 0600, also over an existing file", async () => {
    await saveConfig({ TIX_CONFIG: path }, { convexUrl: "https://a.convex.cloud", token: "tix_a" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    chmodSync(path, 0o644);
    await saveConfig({ TIX_CONFIG: path }, { convexUrl: "https://a.convex.cloud", token: "tix_a" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});
