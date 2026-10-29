import type { ParseArgsOptionsConfig } from "node:util";
import type { TixClient } from "../client.ts";
import { TixError } from "../errors.ts";
import type { Git } from "../git.ts";
import { resolveProject } from "../project.ts";

export type Env = Record<string, string | undefined>;

/** Everything a command can use. Tests pass fakes for the client and git. */
export type Context = {
  cwd: string;
  env: Env;
  git: Git;
  /** Makes the client on first use, so `login` and `help` work with no configuration. */
  client: () => Promise<TixClient>;
  out: (text: string) => void;
  err: (text: string) => void;
};

export type Input = {
  /** No option sets `multiple`, so arrays do not occur. parseArgs types allow them. */
  values: Record<string, string | boolean | (string | boolean)[] | undefined>;
  positionals: string[];
  json: boolean;
  project: string | undefined;
};

export type Command = {
  name: string;
  usage: string;
  summary: string;
  /** More help lines for `tix help <command>`. */
  notes?: string[];
  options?: ParseArgsOptionsConfig;
  run: (ctx: Context, input: Input) => Promise<void>;
};

/** Prints JSON with --json, otherwise the text lines. */
export function print(ctx: Context, input: Input, json: unknown, lines: () => string[]): void {
  if (input.json) {
    ctx.out(JSON.stringify(json, null, 2));
  } else {
    for (const line of lines()) ctx.out(line);
  }
}

export function noPositionals(input: Input): void {
  if (input.positionals.length > 0) {
    throw new TixError("USAGE", `Unexpected argument ${input.positionals[0]}`);
  }
}

/** The one positional argument of the command, for example `<id>`. */
export function onePositional(input: Input, label: string): string {
  if (input.positionals.length !== 1) throw new TixError("USAGE", `Expected one <${label}> argument`);
  return input.positionals[0];
}

export function stringOption(input: Input, name: string): string | undefined {
  const value = input.values[name];
  return typeof value === "string" ? value : undefined;
}

export function requiredOption(input: Input, name: string): string {
  const value = stringOption(input, name);
  if (value === undefined) throw new TixError("USAGE", `--${name} is required`);
  return value;
}

/** Reads `-p, --priority` as an integer. The server checks the range. */
export function priorityOption(input: Input): number | undefined {
  const value = stringOption(input, "priority");
  if (value === undefined) return undefined;
  if (!/^-?\d+$/.test(value)) throw new TixError("USAGE", `--priority must be an integer, not ${value}`);
  return Number(value);
}

export function projectKey(ctx: Context, input: Input): Promise<string> {
  return resolveProject(input.project, () => ctx.git.remoteUrl(ctx.cwd));
}
