import { onePositional, print } from "./command.ts";
import type { Command } from "./command.ts";

export const remove: Command = {
  name: "delete",
  usage: "delete <id>",
  summary: "Delete the task and its subtasks.",
  async run(ctx, input) {
    const id = onePositional(input, "id");
    const deleted = await (await ctx.client()).removeTask({ id });
    print(ctx, input, deleted, () => [`Deleted ${deleted.length} task(s): ${deleted.join(", ")}`]);
  },
};
