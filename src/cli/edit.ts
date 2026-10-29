import { TixError } from "../errors.ts";
import { formatLine } from "../format.ts";
import { onePositional, print, priorityOption, stringOption } from "./command.ts";
import type { Command } from "./command.ts";

export const edit: Command = {
  name: "edit",
  usage: "edit <id> [--name n] [-d desc] [-p prio] [--parent id|--no-parent]",
  summary: "Change fields.",
  notes: [
    "",
    "  --name <text>               New name",
    "  -d, --description <text>    New description",
    "  -p, --priority <n>          New priority from 0 to 100",
    "  --parent <id>               Move the task under <id>",
    "  --no-parent                 Make the task a root task",
  ],
  options: {
    name: { type: "string" },
    description: { type: "string", short: "d" },
    priority: { type: "string", short: "p" },
    parent: { type: "string" },
    "no-parent": { type: "boolean" },
  },
  async run(ctx, input) {
    const id = onePositional(input, "id");
    const noParent = input.values["no-parent"] === true;
    const parentId = stringOption(input, "parent");
    if (noParent && parentId !== undefined) throw new TixError("USAGE", "Use --parent or --no-parent, not both");
    const fields = {
      name: stringOption(input, "name"),
      description: stringOption(input, "description"),
      priority: priorityOption(input),
      parent: noParent ? null : parentId,
    };
    if (Object.values(fields).every((value) => value === undefined)) {
      throw new TixError("USAGE", "Nothing to change. Run tix help edit");
    }
    const task = await (await ctx.client()).updateTask({ id, ...fields });
    print(ctx, input, task, () => [formatLine(task)]);
  },
};
