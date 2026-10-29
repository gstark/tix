import { formatLine } from "../format.ts";
import { onePositional, print } from "./command.ts";
import type { Command } from "./command.ts";

export const start: Command = {
  name: "start",
  usage: "start <id>",
  summary: "Record startedAt.",
  async run(ctx, input) {
    const id = onePositional(input, "id");
    const task = await (await ctx.client()).startTask({ id });
    print(ctx, input, task, () => [formatLine(task)]);
  },
};
