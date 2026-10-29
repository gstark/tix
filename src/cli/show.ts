import { formatDetail } from "../format.ts";
import { onePositional, print } from "./command.ts";
import type { Command } from "./command.ts";

export const show: Command = {
  name: "show",
  usage: "show <id>",
  summary: "Show all fields, subtasks, and blockers.",
  async run(ctx, input) {
    const id = onePositional(input, "id");
    const task = await (await ctx.client()).getTask({ id });
    print(ctx, input, task, () => formatDetail(task));
  },
};
