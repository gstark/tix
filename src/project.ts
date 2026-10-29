import { TixError } from "./errors.ts";

/**
 * Turns a git remote URL into a project key: lowercase host and path, with no
 * user name, port, or `.git` suffix. Returns null for a remote with no host.
 */
export function normalizeRemote(remote: string): string | null {
  const trimmed = remote.trim();
  let host: string;
  let path: string;
  if (trimmed.includes("://")) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    host = url.hostname;
    path = url.pathname;
  } else {
    // scp-like syntax: [user@]host:path
    const match = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(trimmed);
    if (!match) return null;
    [, host, path] = match;
  }
  path = path.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
  if (!host || !path) return null;
  return `${host}/${path}`.toLowerCase();
}

/** Finds the project key: the flag first, then the origin remote. */
export async function resolveProject(
  flag: string | undefined,
  readRemote: () => Promise<string | null>,
): Promise<string> {
  if (flag !== undefined) return flag;
  const remote = await readRemote();
  if (remote === null) {
    throw new TixError("USAGE", "No git remote origin in this directory. Use --project <key>");
  }
  const key = normalizeRemote(remote);
  if (key === null) {
    throw new TixError("USAGE", `Cannot make a project key from remote ${remote}. Use --project <key>`);
  }
  return key;
}
