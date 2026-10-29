import { TixError } from "../errors.ts";
import { formatLine } from "../format.ts";
import { onePositional, print, stringOption } from "./command.ts";
import type { Command } from "./command.ts";

export const done: Command = {
  name: "done",
  usage: "done <id> [-r result] [--commit sha]",
  summary: "Close a task.",
  notes: [
    "",
    "  -r, --result <text>    What was done",
    "  --commit <sha>         Link a commit. tix reads the branch and message from git",
  ],
  options: {
    result: { type: "string", short: "r" },
    commit: { type: "string" },
  },
  async run(ctx, input) {
    const id = onePositional(input, "id");
    const ref = stringOption(input, "commit");
    const commit = ref === undefined ? undefined : await ctx.git.commit(ctx.cwd, ref);
    if (commit === null) throw new TixError("USAGE", `${ref} is not a commit in ${ctx.cwd}`);
    const task = await (await ctx.client()).completeTask({ id, result: stringOption(input, "result"), commit });
    print(ctx, input, task, () => [formatLine(task)]);
  },
};
