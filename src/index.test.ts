import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
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

describe("tix mcp", () => {
  it("answers tools/list over stdio", async () => {
    const child = spawn(process.execPath, [entry, "mcp"], { stdio: ["pipe", "pipe", "inherit"] });
    const lines = createInterface({ input: child.stdout });
    const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`);
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    try {
      for await (const line of lines) {
        const message = JSON.parse(line);
        if (message.id !== 2) continue;
        expect(message.result.tools).toHaveLength(5);
        return;
      }
      expect.unreachable("The server closed stdout before it answered tools/list");
    } finally {
      child.kill();
    }
  });
});
