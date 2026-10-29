import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMachine } from "./auth";

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireMachine(ctx, token);
    const projects = await ctx.db.query("projects").withIndex("by_key").collect();
    return projects.map((project) => ({ key: project.key, openCount: 0 }));
  },
});
