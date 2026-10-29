import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const entry = fileURLToPath(new URL("./index.ts", import.meta.url));

describe("src/index.ts", () => {
  it("runs under Node with no build step", async () => {
    const { stdout, stderr } = await run(process.execPath, [entry, "help"]);
    expect(stdout).toContain("Usage: tix <command>");
    expect(stderr).toBe("");
  });

  it("exits with code 2 when there is no configuration", async () => {
    const env = { PATH: process.env.PATH, TIX_CONFIG: "/nonexistent/tix/config.toml" };
    const error = await run(process.execPath, [entry, "list", "--project", "x"], { env }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 2, stderr: expect.stringContaining("No Convex URL or token") });
  });
});
