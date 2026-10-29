import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import type { TixClient } from "../client.ts";
import { TixError } from "../errors.ts";
import type { Git } from "../git.ts";
import { resolveProject } from "../project.ts";

/** What the server needs. The CLI `Context` has these fields, so `tix mcp` passes its context. */
export type McpContext = {
  cwd: string;
  git: Git;
  client: () => Promise<TixClient>;
};

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

/** Runs a tool. A failure becomes an `isError` result, so the server keeps running. */
async function respond(work: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await work(), null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true };
  }
}

const project = z
  .string()
  .min(1)
  .optional()
  .describe("Project key, for example github.com/acme/api. The default comes from the git remote origin.");
const priority = z.number().int().min(0).max(100).describe("Lower is more important. The default is 1.");

const updateFields = {
  edit: ["name", "description", "priority", "parent"],
  start: [],
  complete: ["result", "commit"],
  reopen: [],
  delete: [],
} as const;

export function createMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer({ name: "tix", version: "0.1.0" });
  const projectKey = (flag: string | undefined) => resolveProject(flag, () => ctx.git.remoteUrl(ctx.cwd));

  server.registerTool(
    "create_task",
    {
      description:
        "Create a task. Write the description like an issue body: what to do, why, the approach, and how to verify it.",
      inputSchema: {
        name: z.string().min(1).describe("One-line summary"),
        description: z.string().optional(),
        priority: priority.optional(),
        parent: z.string().min(1).optional().describe("Short ID of the parent task"),
        project,
      },
    },
    (args) =>
      respond(async () => {
        const key = await projectKey(args.project);
        return (await ctx.client()).createTask({
          projectKey: key,
          name: args.name,
          description: args.description,
          priority: args.priority,
          parent: args.parent,
        });
      }),
  );

  server.registerTool(
    "list_tasks",
    {
      description: "List tasks without descriptions. Each task has parentShortId and blockedBy, so you can build the tree.",
      inputSchema: {
        filter: z
          .enum(["open", "closed", "all", "ready"])
          .optional()
          .describe("The default is open. ready means open and not blocked by an open task."),
        all_projects: z.boolean().optional().describe("List the tasks of all projects"),
        project,
      },
    },
    (args) =>
      respond(async () => {
        const allProjects = args.all_projects === true;
        const key = allProjects ? undefined : await projectKey(args.project);
        return (await ctx.client()).listTasks({ filter: args.filter ?? "open", projectKey: key, allProjects });
      }),
  );

  server.registerTool(
    "show_task",
    {
      description: "Show one task with its description, subtasks, blockers, and the tasks it blocks.",
      inputSchema: { id: z.string().min(1).describe("Short ID") },
    },
    (args) => respond(async () => (await ctx.client()).getTask({ id: args.id })),
  );

  server.registerTool(
    "update_task",
    {
      description: [
        "Change a task. The action selects the change:",
        "edit: change name, description, priority, or parent (null makes a root task).",
        "start: record the start time.",
        "complete: close the task with result and an optional commit. A task with open subtasks cannot close.",
        "reopen: open a closed task.",
        "delete: delete the task and all its subtasks.",
      ].join("\n"),
      inputSchema: {
        action: z.enum(["edit", "start", "complete", "reopen", "delete"]),
        id: z.string().min(1).describe("Short ID"),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: priority.optional(),
        parent: z.string().min(1).nullable().optional(),
        result: z.string().optional().describe("What was done, like a pull request description"),
        commit: z.string().min(1).optional().describe("A git ref. tix reads the SHA, branch, and message from git"),
      },
    },
    (args) =>
      respond(async () => {
        const { action, id, ...fields } = args;
        const allowed: readonly string[] = updateFields[action];
        const extra = Object.keys(fields).filter((field) => !allowed.includes(field));
        if (extra.length > 0) throw new TixError("USAGE", `${extra.join(", ")} cannot be used with action ${action}`);

        const client = await ctx.client();
        switch (action) {
          case "edit":
            if (Object.keys(fields).length === 0) throw new TixError("USAGE", "Nothing to change");
            return client.updateTask({
              id,
              name: fields.name,
              description: fields.description,
              priority: fields.priority,
              parent: fields.parent,
            });
          case "start":
            return client.startTask({ id });
          case "complete": {
            const commit = fields.commit === undefined ? undefined : await ctx.git.commit(ctx.cwd, fields.commit);
            if (commit === null) throw new TixError("USAGE", `${fields.commit} is not a commit in ${ctx.cwd}`);
            return client.completeTask({ id, result: fields.result, commit });
          }
          case "reopen":
            return client.reopenTask({ id });
          case "delete":
            return { deleted: await client.removeTask({ id }) };
        }
      }),
  );

  server.registerTool(
    "manage_blockers",
    {
      description: "Add or remove a blocker. A blocked task is not ready until its blocker closes.",
      inputSchema: {
        action: z.enum(["add", "remove"]),
        id: z.string().min(1).describe("Short ID of the blocked task"),
        blocker: z.string().min(1).describe("Short ID of the task that must close first"),
      },
    },
    (args) =>
      respond(async () => {
        const client = await ctx.client();
        const ids = { blocked: args.id, blocker: args.blocker };
        return args.action === "add" ? client.addBlocker(ids) : client.removeBlocker(ids);
      }),
  );

  return server;
}
