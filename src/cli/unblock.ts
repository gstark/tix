import { formatLine } from "../format.ts";
import { onePositional, print, requiredOption } from "./command.ts";
import type { Command } from "./command.ts";

export const unblock: Command = {
  name: "unblock",
  usage: "unblock <id> --by <id>",
  summary: "Remove a blocker.",
  notes: ["", "  --by <id>    The blocker to remove"],
  options: { by: { type: "string" } },
  async run(ctx, input) {
    const blocked = onePositional(input, "id");
    const task = await (await ctx.client()).removeBlocker({ blocked, blocker: requiredOption(input, "by") });
    print(ctx, input, task, () => [formatLine(task)]);
  },
};
