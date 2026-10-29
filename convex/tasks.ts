import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireMachine } from "./auth";
import { fail } from "./errors";
import type { TaskSummary, TaskView } from "./model";
import {
  checkParent,
  checkPriority,
  checkText,
  childrenOf,
  descendantsOf,
  findProject,
  findTask,
  newShortId,
  summaryOf,
  toView,
  viewOf,
} from "./model";
import { commitValidator } from "./schema";

export const create = mutation({
  args: {
    token: v.string(),
    projectKey: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    parent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMachine(ctx, args.token);
    checkText("projectKey", args.projectKey, 1);
    checkText("name", args.name, 1);
    const description = args.description ?? "";
    checkText("description", description, 0);
    const priority = args.priority ?? 1;
    checkPriority(priority);

    // A failed check later in this mutation rolls back this insert.
    const projectId =
      (await findProject(ctx, args.projectKey))?._id ??
      (await ctx.db.insert("projects", { key: args.projectKey }));
    const parent = args.parent === undefined ? null : await findTask(ctx, args.parent);
    if (parent) await checkParent(ctx, projectId, parent);

    const id = await ctx.db.insert("tasks", {
      projectId,
      parentId: parent?._id,
      shortId: await newShortId(ctx),
      name: args.name,
      description,
      priority,
      completed: false,
    });
    return toView(ctx, (await ctx.db.get(id))!, args.projectKey);
  },
});

export const get = query({
  args: { token: v.string(), id: v.string() },
  handler: async (ctx, { token, id }) => {
    await requireMachine(ctx, token);
    const task = await findTask(ctx, id);
    const view = await viewOf(ctx, task);
    const children = await Promise.all(
      (await childrenOf(ctx, task._id)).map((child) => toView(ctx, child, view.projectKey)),
    );
    const blockerRows = await ctx.db
      .query("blockers")
      .withIndex("by_blocked", (q) => q.eq("blockedId", task._id))
      .collect();
    const blocksRows = await ctx.db
      .query("blockers")
      .withIndex("by_blocker", (q) => q.eq("blockerId", task._id))
      .collect();
    const isSummary = (summary: TaskSummary | null): summary is TaskSummary => summary !== null;
    const blockers = (await Promise.all(blockerRows.map((row) => summaryOf(ctx, row.blockerId)))).filter(isSummary);
    const blocks = (await Promise.all(blocksRows.map((row) => summaryOf(ctx, row.blockedId)))).filter(isSummary);
    return { ...view, children, blockers, blocks };
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    parent: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireMachine(ctx, args.token);
    const task = await findTask(ctx, args.id);
    const patch: Partial<Pick<Doc<"tasks">, "name" | "description" | "priority" | "parentId">> = {};

    if (args.name !== undefined) {
      checkText("name", args.name, 1);
      patch.name = args.name;
    }
    if (args.description !== undefined) {
      checkText("description", args.description, 0);
      patch.description = args.description;
    }
    if (args.priority !== undefined) {
      checkPriority(args.priority);
      patch.priority = args.priority;
    }
    if (args.parent === null) {
      patch.parentId = undefined;
    } else if (args.parent !== undefined) {
      const parent = await findTask(ctx, args.parent);
      await checkParent(ctx, task.projectId, parent, task._id);
      patch.parentId = parent._id;
    }

    await ctx.db.patch(task._id, patch);
    return viewOf(ctx, { ...task, ...patch });
  },
});

export const start = mutation({
  args: { token: v.string(), id: v.string() },
  handler: async (ctx, { token, id }) => {
    await requireMachine(ctx, token);
    const task = await findTask(ctx, id);
    if (task.completed) fail("INVALID_INPUT", `Task ${task.shortId} is closed. Reopen it first`);
    if (task.startedAt !== undefined) return viewOf(ctx, task);
    const patch = { startedAt: Date.now() };
    await ctx.db.patch(task._id, patch);
    return viewOf(ctx, { ...task, ...patch });
  },
});

export const complete = mutation({
  args: {
    token: v.string(),
    id: v.string(),
    result: v.optional(v.string()),
    commit: v.optional(commitValidator),
  },
  handler: async (ctx, args) => {
    await requireMachine(ctx, args.token);
    const task = await findTask(ctx, args.id);
    if (args.result !== undefined) checkText("result", args.result, 0);
    const open = (await descendantsOf(ctx, task._id)).filter((child) => !child.completed);
    if (open.length > 0) {
      fail("OPEN_CHILDREN", `Task ${task.shortId} has ${open.length} open subtask(s)`);
    }
    const patch: Partial<Pick<Doc<"tasks">, "completed" | "completedAt" | "result" | "commit">> = {
      completed: true,
      completedAt: task.completedAt ?? Date.now(),
    };
    if (args.result !== undefined) patch.result = args.result;
    if (args.commit !== undefined) patch.commit = args.commit;
    await ctx.db.patch(task._id, patch);
    return viewOf(ctx, { ...task, ...patch });
  },
});

export const reopen = mutation({
  args: { token: v.string(), id: v.string() },
  handler: async (ctx, { token, id }) => {
    await requireMachine(ctx, token);
    const task = await findTask(ctx, id);
    const patch = { completed: false, completedAt: undefined };
    await ctx.db.patch(task._id, patch);
    return viewOf(ctx, { ...task, ...patch });
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.string() },
  handler: async (ctx, { token, id }) => {
    await requireMachine(ctx, token);
    const task = await findTask(ctx, id);
    const doomed = [task, ...(await descendantsOf(ctx, task._id))];

    // A Set because one row can link two deleted tasks.
    const rowIds = new Set<Id<"blockers">>();
    for (const { _id } of doomed) {
      const asBlocker = await ctx.db
        .query("blockers")
        .withIndex("by_blocker", (q) => q.eq("blockerId", _id))
        .collect();
      const asBlocked = await ctx.db
        .query("blockers")
        .withIndex("by_blocked", (q) => q.eq("blockedId", _id))
        .collect();
      for (const row of [...asBlocker, ...asBlocked]) rowIds.add(row._id);
    }

    for (const rowId of rowIds) await ctx.db.delete(rowId);
    for (const { _id } of doomed) await ctx.db.delete(_id);
    return doomed.map((doomedTask) => doomedTask.shortId);
  },
});

const filterValidator = v.union(v.literal("open"), v.literal("closed"), v.literal("all"), v.literal("ready"));

type Filter = "open" | "closed" | "all" | "ready";

/** Reads tasks for one project, or for all projects when `projectId` is null. */
async function tasksFor(ctx: QueryCtx, projectId: Id<"projects"> | null, filter: Filter) {
  const completed = filter === "closed";
  const any = filter === "all";
  if (projectId === null) {
    return ctx.db
      .query("tasks")
      .withIndex("by_completed_priority", (q) => (any ? q : q.eq("completed", completed)))
      .collect();
  }
  return ctx.db
    .query("tasks")
    .withIndex("by_project_completed_priority", (q) =>
      any ? q.eq("projectId", projectId) : q.eq("projectId", projectId).eq("completed", completed),
    )
    .collect();
}

export const list = query({
  args: {
    token: v.string(),
    projectKey: v.optional(v.string()),
    filter: filterValidator,
    allProjects: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<TaskView[]> => {
    await requireMachine(ctx, args.token);
    let projectId: Id<"projects"> | null = null;
    if (!args.allProjects) {
      if (args.projectKey === undefined) fail("INVALID_INPUT", "projectKey is required without allProjects");
      const project = await findProject(ctx, args.projectKey);
      if (!project) return [];
      projectId = project._id;
    }

    const keys = new Map<Id<"projects">, string>();
    const views: TaskView[] = [];
    for (const task of await tasksFor(ctx, projectId, args.filter)) {
      let key = keys.get(task.projectId);
      if (key === undefined) {
        key = (await ctx.db.get(task.projectId))?.key ?? "";
        keys.set(task.projectId, key);
      }
      views.push(await toView(ctx, task, key));
    }
    return args.filter === "ready" ? views.filter((view) => view.blockedBy.length === 0) : views;
  },
});
