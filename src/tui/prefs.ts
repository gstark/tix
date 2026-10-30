import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse, stringify } from "smol-toml";
import { configPath } from "../config.ts";

type Env = Record<string, string | undefined>;

/** UI state sits next to config.toml. `TIX_CONFIG` selects that directory. */
export function uiPath(env: Env): string {
  return join(dirname(configPath(env)), "ui.toml");
}

function boardWidthOf(table: Record<string, unknown>): number | null {
  const width = table.board_width;
  if (typeof width !== "number" || !Number.isInteger(width) || width < 1) return null;
  return width;
}

async function readUi(path: string): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};
    throw error;
  }
  try {
    const table = parse(text);
    if (typeof table !== "object" || table === null || Array.isArray(table)) return {};
    return table;
  } catch {
    return {};
  }
}

/** The saved list width, in columns. `null` means the board has never been resized. */
export async function loadBoardWidth(env: Env): Promise<number | null> {
  try {
    return boardWidthOf(await readUi(uiPath(env)));
  } catch {
    return null;
  }
}

async function writeBoardWidth(env: Env, width: number): Promise<void> {
  if (!Number.isInteger(width) || width < 1) throw new Error("The list width must be a whole number of columns");
  const path = uiPath(env);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, stringify({ board_width: width }) + "\n", { mode: 0o644 });
}

// A second drag can finish before the first write. Keep the writes in order.
let tail: Promise<void> = Promise.resolve();

/** Saves the list width. The ticket uses the columns that remain. */
export function saveBoardWidth(env: Env, width: number): Promise<void> {
  const job = tail.then(() => writeBoardWidth(env, width));
  tail = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}
