import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { requireMachine } from "./auth";
import { fail } from "./errors";
import { findTask, viewOf } from "./model";

async function findRow(ctx: QueryCtx, blockedId: Id<"tasks">, blockerId: Id<"tasks">) {
  return ctx.db
    .query("blockers")
    .withIndex("by_blocked", (q) => q.eq("blockedId", blockedId).eq("blockerId", blockerId))
    .unique();
}

/** True if `start` already waits on `target` through a chain of blockers. */
async function waitsOn(ctx: QueryCtx, start: Id<"tasks">, target: Id<"tasks">): Promise<boolean> {
  const seen = new Set<Id<"tasks">>();
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const rows = await ctx.db
      .query("blockers")
      .withIndex("by_blocked", (q) => q.eq("blockedId", current))
      .collect();
    stack.push(...rows.map((row) => row.blockerId));
  }
  return false;
}

const pairArgs = { token: v.string(), blocked: v.string(), blocker: v.string() };

export const add = mutation({
  args: pairArgs,
  handler: async (ctx, args) => {
    await requireMachine(ctx, args.token);
    const blocked = await findTask(ctx, args.blocked);
    const blocker = await findTask(ctx, args.blocker);
    if (blocked._id === blocker._id) fail("BLOCKER_CYCLE", "A task cannot block itself");
    if (blocked.projectId !== blocker.projectId) {
      fail("CROSS_PROJECT", `Blocker ${blocker.shortId} is in a different project`);
    }
    if (!(await findRow(ctx, blocked._id, blocker._id))) {
      if (await waitsOn(ctx, blocker._id, blocked._id)) {
        fail("BLOCKER_CYCLE", `Task ${blocker.shortId} already waits on ${blocked.shortId}`);
      }
      await ctx.db.insert("blockers", { blockedId: blocked._id, blockerId: blocker._id });
    }
    return viewOf(ctx, blocked);
  },
});

export const remove = mutation({
  args: pairArgs,
  handler: async (ctx, args) => {
    await requireMachine(ctx, args.token);
    const blocked = await findTask(ctx, args.blocked);
    const blocker = await findTask(ctx, args.blocker);
    const row = await findRow(ctx, blocked._id, blocker._id);
    if (!row) fail("NOT_FOUND", `Task ${blocker.shortId} does not block ${blocked.shortId}`);
    await ctx.db.delete(row._id);
    return viewOf(ctx, blocked);
  },
});
