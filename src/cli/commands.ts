import { TixError } from "../errors.ts";
import type { Command } from "./command.ts";
import { helpLines } from "./help.ts";
import { block } from "./block.ts";
import { create } from "./create.ts";
import { remove } from "./delete.ts";
import { done } from "./done.ts";
import { edit } from "./edit.ts";
import { list } from "./list.ts";
import { login } from "./login.ts";
import { plan } from "./plan.ts";
import { projects } from "./projects.ts";
import { reopen } from "./reopen.ts";
import { show } from "./show.ts";
import { start } from "./start.ts";
import { unblock } from "./unblock.ts";

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
export const commands: Command[] = [
  list,
  create,
  show,
  edit,
  start,
  done,
  reopen,
  remove,
  block,
  unblock,
  plan,
  projects,
  login,
  help,
];
