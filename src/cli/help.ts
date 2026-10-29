import { TixError } from "../errors.ts";
import type { Command } from "./command.ts";

const GLOBAL_OPTIONS = [
  "Global options:",
  "  --json             Print JSON",
  "  --project <key>    Use this project key, not the git remote",
  "  -h, --help         Show help",
];

/** Help for all commands, or for one command. */
export function helpLines(commands: Command[], name?: string): string[] {
  if (name === undefined) {
    const width = Math.max(...commands.map((command) => command.usage.length));
    return [
      "Usage: tix <command> [options]",
      "",
      "Commands:",
      ...commands.map((command) => `  ${command.usage.padEnd(width)}  ${command.summary}`),
      "",
      ...GLOBAL_OPTIONS,
    ];
  }
  const command = commands.find((candidate) => candidate.name === name);
  if (!command) throw new TixError("USAGE", `Unknown command ${name}. Run tix help`);
  return [`Usage: tix ${command.usage}`, "", command.summary, ...(command.notes ?? []), "", ...GLOBAL_OPTIONS];
}
