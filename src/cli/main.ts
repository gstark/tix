import { parseArgs } from "node:util";
import type { ParseArgsOptionsConfig } from "node:util";
import { TixError, exitCodeOf } from "../errors.ts";
import type { Command, Context } from "./command.ts";
import { commands } from "./commands.ts";
import { helpLines } from "./help.ts";

const GLOBAL_OPTIONS: ParseArgsOptionsConfig = {
  json: { type: "boolean" },
  project: { type: "string" },
  help: { type: "boolean", short: "h" },
};

function isParseArgsError(error: unknown): error is Error {
  return error instanceof TypeError && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS");
}

function find(name: string): Command {
  const command = commands.find((candidate) => candidate.name === name);
  if (!command) throw new TixError("USAGE", `Unknown command ${name}. Run tix help`);
  return command;
}

/** Runs one CLI command and returns the exit code. */
export async function main(argv: string[], ctx: Context): Promise<number> {
  // `tix` and `tix --ready` run `list`.
  const implicit = argv.length === 0 || argv[0].startsWith("-");
  const name = implicit ? "list" : argv[0];
  const args = implicit ? argv : argv.slice(1);
  try {
    const command = find(name);
    const { values, positionals } = parseArgs({
      args,
      options: { ...GLOBAL_OPTIONS, ...command.options },
      allowPositionals: true,
      strict: true,
    });
    if (values.help === true) {
      for (const line of helpLines(commands, command.name)) ctx.out(line);
      return 0;
    }
    await command.run(ctx, {
      values,
      positionals,
      json: values.json === true,
      project: typeof values.project === "string" ? values.project : undefined,
    });
    return 0;
  } catch (error) {
    if (error instanceof TixError) {
      ctx.err(`Error: ${error.message}`);
      return exitCodeOf(error.code);
    }
    if (isParseArgsError(error)) {
      // Node adds a long hint after the first sentence. Keep only the first sentence.
      ctx.err(`Error: ${error.message.split(". ")[0]}. Run tix help ${name}`);
      return 1;
    }
    ctx.err(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
