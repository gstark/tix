import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TixError } from "../errors.ts";
import { parsePlan } from "../plan.ts";
import { onePositional, print, projectKey } from "./command.ts";
import type { Command } from "./command.ts";

export const plan: Command = {
  name: "plan",
  usage: "plan <file.md>",
  summary: "Create one task from a plan document.",
  notes: [
    "",
    "The name is the first `# ` heading without a `Plan: ` prefix, or the file name.",
    "The description is the full file. Prints the short ID.",
  ],
  async run(ctx, input) {
    const file = onePositional(input, "file.md");
    let content: string;
    try {
      content = await readFile(resolve(ctx.cwd, file), "utf8");
    } catch {
      throw new TixError("USAGE", `Cannot read ${file}`);
    }
    const parsed = parsePlan(content, file);
    const key = await projectKey(ctx, input);
    const task = await (await ctx.client()).createTask({ projectKey: key, ...parsed });
    print(ctx, input, task, () => [task.shortId]);
  },
};
