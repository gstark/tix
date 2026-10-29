import { TixError } from "../errors.ts";
import type { Command } from "./command.ts";
import { helpLines } from "./help.ts";
import { projects } from "./projects.ts";

const help: Command = {
  name: "help",
  usage: "help [command]",
  summary: "Show help.",
  async run(ctx, input) {
    if (input.positionals.length > 1) throw new TixError("USAGE", "Expected at most one command name");
    for (const line of helpLines(commands, input.positionals[0])) ctx.out(line);
  },
};

/** All commands, in the order that `tix help` shows them. */
export const commands: Command[] = [projects, help];
