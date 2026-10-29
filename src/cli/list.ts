import type { ListFilter } from "../client.ts";
import { TixError } from "../errors.ts";
import { formatGroups, formatTree } from "../format.ts";
import { noPositionals, print, projectKey } from "./command.ts";
import type { Command } from "./command.ts";

const FILTERS = ["closed", "all", "ready"] as const;

export const list: Command = {
  name: "list",
  usage: "list [--closed | --all | --ready] [--all-projects]",
  summary: "Show open tasks of the current project as a tree.",
  notes: [
    "",
    "  --closed          Show closed tasks",
    "  --all             Show open and closed tasks",
    "  --ready           Show open tasks that no open task blocks",
    "  --all-projects    Show tasks of all projects, grouped by project",
    "",
    "`tix` with no command runs `tix list`.",
  ],
  options: {
    closed: { type: "boolean" },
    all: { type: "boolean" },
    ready: { type: "boolean" },
    "all-projects": { type: "boolean" },
  },
  async run(ctx, input) {
    noPositionals(input);
    const chosen = FILTERS.filter((name) => input.values[name] === true);
    if (chosen.length > 1) throw new TixError("USAGE", "Use only one of --closed, --all, and --ready");
    const filter: ListFilter = chosen[0] ?? "open";
    const allProjects = input.values["all-projects"] === true;
    const key = allProjects ? undefined : await projectKey(ctx, input);
    const tasks = await (await ctx.client()).listTasks({ filter, projectKey: key, allProjects });
    print(ctx, input, tasks, () => {
      if (tasks.length === 0) return ["No tasks"];
      return allProjects ? formatGroups(tasks) : formatTree(tasks);
    });
  },
};
