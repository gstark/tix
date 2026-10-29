import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMachine } from "./auth";

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireMachine(ctx, token);
    const projects = await ctx.db.query("projects").withIndex("by_key").collect();
    return Promise.all(
      projects.map(async (project) => {
        const open = await ctx.db
          .query("tasks")
          .withIndex("by_project_completed_priority", (q) =>
            q.eq("projectId", project._id).eq("completed", false),
          )
          .collect();
        return { key: project.key, openCount: open.length };
      }),
    );
  },
});
