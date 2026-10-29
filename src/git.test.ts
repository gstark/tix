import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { systemGit } from "./git.ts";

let dir: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tix-git-"));
  git("init", "--quiet", "--initial-branch", "main");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "fix: parser");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("systemGit.remoteUrl", () => {
  it("returns null when there is no origin", async () => {
    expect(await systemGit.remoteUrl(dir)).toBeNull();
  });

  it("returns the origin URL", async () => {
    git("remote", "add", "origin", "git@github.com:acme/api.git");
    expect(await systemGit.remoteUrl(dir)).toBe("git@github.com:acme/api.git");
  });
});

describe("systemGit.commit", () => {
  it("returns the full SHA, the branch, and the subject", async () => {
    const sha = git("rev-parse", "HEAD");
    expect(await systemGit.commit(dir, sha.slice(0, 7))).toEqual({ sha, branch: "main", message: "fix: parser" });
  });

  it("leaves out the branch on a detached HEAD", async () => {
    const sha = git("rev-parse", "HEAD");
    git("checkout", "--quiet", "--detach");
    expect(await systemGit.commit(dir, "HEAD")).toEqual({ sha, message: "fix: parser" });
  });

  it("returns null for a ref that is not a commit", async () => {
    expect(await systemGit.commit(dir, "nope")).toBeNull();
  });
});
