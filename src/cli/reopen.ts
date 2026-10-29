import { formatLine } from "../format.ts";
import { onePositional, print } from "./command.ts";
import type { Command } from "./command.ts";

export const reopen: Command = {
  name: "reopen",
  usage: "reopen <id>",
  summary: "Open a closed task again.",
  async run(ctx, input) {
    const id = onePositional(input, "id");
    const task = await (await ctx.client()).reopenTask({ id });
    print(ctx, input, task, () => [formatLine(task)]);
  },
};
