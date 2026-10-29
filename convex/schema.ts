import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const commitValidator = v.object({
  sha: v.string(),
  branch: v.optional(v.string()),
  message: v.optional(v.string()),
});

export default defineSchema({
  projects: defineTable({
    key: v.string(),
  }).index("by_key", ["key"]),

  tasks: defineTable({
    projectId: v.id("projects"),
    parentId: v.optional(v.id("tasks")),
    shortId: v.string(),
    name: v.string(),
    description: v.string(),
    priority: v.number(),
    completed: v.boolean(),
    result: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    commit: v.optional(commitValidator),
  })
    .index("by_shortId", ["shortId"])
    .index("by_parent", ["parentId"])
    .index("by_project_completed_priority", ["projectId", "completed", "priority"])
    .index("by_completed_priority", ["completed", "priority"]),

  blockers: defineTable({
    blockerId: v.id("tasks"),
    blockedId: v.id("tasks"),
  })
    .index("by_blocker", ["blockerId"])
    .index("by_blocked", ["blockedId", "blockerId"]),

  machineTokens: defineTable({
    name: v.string(),
    tokenHash: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_name", ["name"]),
});
