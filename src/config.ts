import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parse, stringify } from "smol-toml";
import { TixError } from "./errors.ts";

export type Config = { convexUrl: string; token: string };

type Env = Record<string, string | undefined>;

export function configPath(env: Env): string {
  return env.TIX_CONFIG ?? join(homedir(), ".config", "tix", "config.toml");
}

async function readTable(path: string): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};
    throw error;
  }
  try {
    return parse(text);
  } catch {
    throw new TixError("CONFIG", `Cannot parse ${path}. It must be TOML`);
  }
}

/** Reads the file, then applies TIX_CONVEX_URL and TIX_TOKEN on top. */
export async function loadConfig(env: Env): Promise<Config> {
  const path = configPath(env);
  const table = await readTable(path);
  const convexUrl = env.TIX_CONVEX_URL ?? table.convex_url;
  const token = env.TIX_TOKEN ?? table.token;
  if (typeof convexUrl !== "string" || typeof token !== "string" || convexUrl === "" || token === "") {
    throw new TixError("CONFIG", `No Convex URL or token in ${path}. Run tix login --url <url> --token <token>`);
  }
  return { convexUrl, token };
}

/** Writes the file with mode 0600 and returns its path. */
export async function saveConfig(env: Env, config: Config): Promise<string> {
  const path = configPath(env);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, stringify({ convex_url: config.convexUrl, token: config.token }) + "\n", { mode: 0o600 });
  // writeFile does not change the mode of a file that already exists.
  await chmod(path, 0o600);
  return path;
}
