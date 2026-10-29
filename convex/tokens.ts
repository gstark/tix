import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { QueryCtx } from "./_generated/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
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

// An action, because Convex seeds random values in mutations.
export const create = internalAction({
  args: { name: v.string() },
  handler: async (ctx, { name }): Promise<string> => {
    const token = randomToken();
    await ctx.runMutation(internal.tokens.store, { name, tokenHash: await sha256Hex(token) });
    return token;
  },
});

export const store = internalMutation({
  args: { name: v.string(), tokenHash: v.string() },
  handler: async (ctx, { name, tokenHash }) => {
    if ((await activeTokens(ctx, name)).length > 0) {
      fail("INVALID_INPUT", `An active token for "${name}" already exists`);
    }
    await ctx.db.insert("machineTokens", { name, tokenHash, createdAt: Date.now() });
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
