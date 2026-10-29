import { describe, expect, it, vi } from "vitest";
import type { TixClient } from "../client.ts";
import { PROJECT, fakeClient, listItem, runCli } from "../test.setup.ts";

function listing(items = [listItem({ shortId: "a1", name: "Fix" })]) {
  const listTasks = vi.fn<TixClient["listTasks"]>(async () => items);
  return { listTasks, client: fakeClient({ listTasks }) };
}

describe("tix list", () => {
  it("lists open tasks of the git remote project as a tree", async () => {
    const { listTasks, client } = listing();
    expect(await runCli([], { client })).toEqual({ code: 0, out: "[ ] a1: Fix", err: "" });
    expect(listTasks).toHaveBeenCalledWith({ filter: "open", projectKey: PROJECT, allProjects: false });
  });

  it.each([
    ["--closed", "closed"],
    ["--all", "all"],
    ["--ready", "ready"],
  ])("passes %s as the filter, also with no command name", async (flag, filter) => {
    const { listTasks, client } = listing();
    await runCli(["list", flag], { client });
    await runCli([flag], { client });
    expect(listTasks).toHaveBeenNthCalledWith(1, expect.objectContaining({ filter }));
    expect(listTasks).toHaveBeenNthCalledWith(2, expect.objectContaining({ filter }));
  });

  it("rejects two filters", async () => {
    expect(await runCli(["list", "--closed", "--ready"])).toMatchObject({ code: 1 });
  });

  it("uses --project and does not read git", async () => {
    const { listTasks, client } = listing();
    const remoteUrl = vi.fn(async () => null);
    await runCli(["list", "--project", "github.com/acme/web"], { client, git: { remoteUrl } });
    expect(listTasks).toHaveBeenCalledWith(expect.objectContaining({ projectKey: "github.com/acme/web" }));
    expect(remoteUrl).not.toHaveBeenCalled();
  });

  it("fails with exit code 1 and names --project when there is no remote", async () => {
    const { code, err } = await runCli(["list"], { git: { remoteUrl: async () => null } });
    expect(code).toBe(1);
    expect(err).toContain("--project");
  });

  it("groups by project with --all-projects and does not read git", async () => {
    const { listTasks, client } = listing([
      listItem({ shortId: "w1", projectKey: "github.com/acme/web" }),
      listItem({ shortId: "a1" }),
    ]);
    const remoteUrl = vi.fn(async () => null);
    const { out } = await runCli(["list", "--all-projects"], { client, git: { remoteUrl } });
    expect(out).toBe("github.com/acme/api\n  [ ] a1: Task\n\ngithub.com/acme/web\n  [ ] w1: Task");
    expect(listTasks).toHaveBeenCalledWith({ filter: "open", projectKey: undefined, allProjects: true });
    expect(remoteUrl).not.toHaveBeenCalled();
  });

  it("prints No tasks for an empty list", async () => {
    expect((await runCli([], { client: listing([]).client })).out).toBe("No tasks");
  });

  it("prints the list as JSON", async () => {
    const items = [listItem({ shortId: "a1" })];
    expect(JSON.parse((await runCli(["--json"], { client: listing(items).client })).out)).toEqual(items);
  });
});
