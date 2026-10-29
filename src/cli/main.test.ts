import { describe, expect, it, vi } from "vitest";
import { TixError } from "../errors.ts";
import { fakeClient, runCli } from "../test.setup.ts";

describe("main", () => {
  it("runs a command and returns 0", async () => {
    const client = fakeClient({ listProjects: async () => [{ key: "github.com/acme/api", openCount: 2 }] });
    expect(await runCli(["projects"], { client })).toEqual({ code: 0, out: "github.com/acme/api  2 open", err: "" });
  });

  it("prints JSON with --json", async () => {
    const result = [{ key: "github.com/acme/api", openCount: 2 }];
    const { out } = await runCli(["projects", "--json"], { client: fakeClient({ listProjects: async () => result }) });
    expect(JSON.parse(out)).toEqual(result);
  });

  it("returns 1 for an unknown command", async () => {
    expect(await runCli(["nope"])).toMatchObject({ code: 1, err: "Error: Unknown command nope. Run tix help" });
  });

  it("returns 1 for an unknown option and names the command help", async () => {
    const { code, err } = await runCli(["projects", "--nope"]);
    expect(code).toBe(1);
    expect(err).toContain("Unknown option '--nope'. Run tix help projects");
  });

  it("returns 1 for an unexpected argument", async () => {
    expect(await runCli(["projects", "extra"])).toMatchObject({ code: 1, err: "Error: Unexpected argument extra" });
  });

  it.each([
    ["NOT_FOUND", 1],
    ["UNAUTHORIZED", 2],
    ["CONFIG", 2],
    ["NETWORK", 3],
  ] as const)("maps a %s error to exit code %i", async (code, exit) => {
    const client = fakeClient({ listProjects: () => Promise.reject(new TixError(code, "Broken")) });
    expect(await runCli(["projects"], { client })).toMatchObject({ code: exit, err: "Error: Broken" });
  });

  it("returns 1 for an error that is not a TixError", async () => {
    const client = fakeClient({ listProjects: () => Promise.reject(new Error("Server Error")) });
    expect(await runCli(["projects"], { client })).toMatchObject({ code: 1, err: "Error: Server Error" });
  });

  it("does not make the client for help", async () => {
    const listProjects = vi.fn();
    const { code, out } = await runCli(["help"], { client: fakeClient({ listProjects }) });
    expect(code).toBe(0);
    expect(out).toContain("Usage: tix <command> [options]");
    expect(out).toContain("projects");
    expect(listProjects).not.toHaveBeenCalled();
  });

  it("shows help for one command with help <command> and with --help", async () => {
    const viaHelp = await runCli(["help", "projects"]);
    const viaFlag = await runCli(["projects", "--help"]);
    expect(viaHelp.out).toContain("Usage: tix projects");
    expect(viaFlag).toEqual(viaHelp);
  });

  it("returns 1 for help on an unknown command", async () => {
    expect(await runCli(["help", "nope"])).toMatchObject({ code: 1 });
  });
});
