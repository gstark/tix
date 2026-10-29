import { formatProjects } from "../format.ts";
import { noPositionals, print } from "./command.ts";
import type { Command } from "./command.ts";

export const projects: Command = {
  name: "projects",
  usage: "projects",
  summary: "List projects with open task counts.",
  async run(ctx, input) {
    noPositionals(input);
    const result = await (await ctx.client()).listProjects();
    print(ctx, input, result, () => (result.length === 0 ? ["No projects"] : formatProjects(result)));
  },
};
