import { onePositional, print, priorityOption, projectKey, stringOption } from "./command.ts";
import type { Command } from "./command.ts";

export const create: Command = {
  name: "create",
  usage: "create <name> [-d desc] [-p prio] [--parent id]",
  summary: "Create a task. Prints the short ID.",
  notes: [
    "",
    "  -d, --description <text>    Description (default: empty)",
    "  -p, --priority <n>          Priority from 0 to 100. Lower comes first (default: 1)",
    "  --parent <id>               Make the task a subtask of <id>",
  ],
  options: {
    description: { type: "string", short: "d" },
    priority: { type: "string", short: "p" },
    parent: { type: "string" },
  },
  async run(ctx, input) {
    const name = onePositional(input, "name");
    const key = await projectKey(ctx, input);
    const task = await (await ctx.client()).createTask({
      projectKey: key,
      name,
      description: stringOption(input, "description"),
      priority: priorityOption(input),
      parent: stringOption(input, "parent"),
    });
    print(ctx, input, task, () => [task.shortId]);
  },
};
