import { formatLine } from "../format.ts";
import { onePositional, print, requiredOption } from "./command.ts";
import type { Command } from "./command.ts";

export const block: Command = {
  name: "block",
  usage: "block <id> --by <id>",
  summary: "Add a blocker.",
  notes: ["", "  --by <id>    The task that must close first"],
  options: { by: { type: "string" } },
  async run(ctx, input) {
    const blocked = onePositional(input, "id");
    const task = await (await ctx.client()).addBlocker({ blocked, blocker: requiredOption(input, "by") });
    print(ctx, input, task, () => [formatLine(task)]);
  },
};
