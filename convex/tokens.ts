import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { sha256Hex } from "./auth";
import { fail } from "./errors";

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes));
  return `tix_${base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

async function activeTokens(ctx: QueryCtx, name: string) {
  const rows = await ctx.db
    .query("machineTokens")
    .withIndex("by_name", (q) => q.eq("name", name))
    .collect();
  return rows.filter((row) => row.revokedAt === undefined);
}

export const create = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    if ((await activeTokens(ctx, name)).length > 0) {
      fail("INVALID_INPUT", `An active token for "${name}" already exists`);
    }
    const token = randomToken();
    await ctx.db.insert("machineTokens", {
      name,
      tokenHash: await sha256Hex(token),
      createdAt: Date.now(),
    });
    return token;
  },
});

export const revoke = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const active = await activeTokens(ctx, name);
    if (active.length === 0) fail("NOT_FOUND", `No active token for "${name}"`);
    for (const row of active) await ctx.db.patch(row._id, { revokedAt: Date.now() });
  },
});

export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("machineTokens").collect();
    return rows.map(({ name, createdAt, revokedAt }) => ({ name, createdAt, revokedAt }));
  },
});
