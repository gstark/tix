import { describe, expect, it } from "vitest";
import { normalizeRemote, resolveProject } from "./project.ts";

describe("normalizeRemote", () => {
  it.each([
    ["git@github.com:acme/api.git", "github.com/acme/api"],
    ["https://github.com/acme/api.git", "github.com/acme/api"],
    ["https://user@gitlab.com/acme/sub/api", "gitlab.com/acme/sub/api"],
    ["ssh://git@github.com:22/acme/api.git", "github.com/acme/api"],
    ["https://GitHub.com/Acme/API.git", "github.com/acme/api"],
    ["https://github.com/acme/api/", "github.com/acme/api"],
    ["github.com:acme/api.git\n", "github.com/acme/api"],
  ])("normalizes %s", (remote: string, key: string) => {
    expect(normalizeRemote(remote)).toBe(key);
  });

  it.each(["/srv/git/api.git", "file:///srv/git/api.git", "not a url", ""])(
    "returns null for %j",
    (remote: string) => {
      expect(normalizeRemote(remote)).toBeNull();
    },
  );
});

describe("resolveProject", () => {
  it("uses the flag and does not read the remote", async () => {
    const key = await resolveProject("github.com/acme/web", () => {
      throw new Error("must not read the remote");
    });
    expect(key).toBe("github.com/acme/web");
  });

  it("uses the normalized origin remote", async () => {
    expect(await resolveProject(undefined, async () => "git@github.com:acme/api.git")).toBe("github.com/acme/api");
  });

  it("fails with USAGE when there is no remote", async () => {
    await expect(resolveProject(undefined, async () => null)).rejects.toMatchObject({
      code: "USAGE",
      message: expect.stringContaining("--project"),
    });
  });

  it("fails with USAGE when the remote has no host", async () => {
    await expect(resolveProject(undefined, async () => "/srv/git/api.git")).rejects.toMatchObject({ code: "USAGE" });
  });
});
