import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../config.ts";
import { runCli } from "../test.setup.ts";

describe("tix login", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tix-login-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves the configuration without a client", async () => {
    const env = { TIX_CONFIG: join(dir, "config.toml") };
    const result = await runCli(["login", "--url", "https://x.convex.cloud", "--token", "secret"], { env });
    expect(result).toEqual({ code: 0, out: `Saved the configuration to ${env.TIX_CONFIG}`, err: "" });
    expect(await loadConfig(env)).toEqual({ convexUrl: "https://x.convex.cloud", token: "secret" });
  });

  it("requires --url and --token", async () => {
    expect(await runCli(["login", "--url", "https://x.convex.cloud"])).toMatchObject({
      code: 1,
      err: "Error: --token is required",
    });
  });
});
