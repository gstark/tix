import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Commit } from "./client.ts";

const run = promisify(execFile);

/** The git reads that tix makes. Tests can pass a fake. */
export interface Git {
  /** The URL of the origin remote, or null if there is none. */
  remoteUrl(cwd: string): Promise<string | null>;
  /** The full SHA, current branch, and subject of a commit, or null if the ref is not a commit. */
  commit(cwd: string, ref: string): Promise<Commit | null>;
}

async function git(cwd: string, ...args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run("git", args, { cwd });
    return stdout.trim();
  } catch {
    return null;
  }
}

export const systemGit: Git = {
  remoteUrl: (cwd) => git(cwd, "remote", "get-url", "origin"),
  async commit(cwd, ref) {
    const sha = await git(cwd, "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`);
    if (sha === null) return null;
    const branch = await git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
    const message = await git(cwd, "show", "-s", "--format=%s", sha);
    const commit: Commit = { sha };
    // A detached HEAD prints "HEAD", which is not a branch.
    if (branch !== null && branch !== "HEAD") commit.branch = branch;
    if (message) commit.message = message;
    return commit;
  },
};
