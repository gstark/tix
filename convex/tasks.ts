import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireMachine } from "./auth";
import type { TaskSummary } from "./model";
import {
  checkParent,
  checkPriority,
  checkText,
  childrenOf,
  findProject,
  findTask,
  newShortId,
  summaryOf,
  toView,
  viewOf,
} from "./model";

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
    const patch: Partial<Doc<"tasks">> = {};

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
