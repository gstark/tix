import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { fail } from "./errors";

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function requireMachine(ctx: QueryCtx, token: string): Promise<Doc<"machineTokens">> {
  const tokenHash = await sha256Hex(token);
  const machine = await ctx.db
    .query("machineTokens")
    .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!machine || machine.revokedAt !== undefined) {
    fail("UNAUTHORIZED", "The token is missing, unknown, or revoked");
  }
  return machine;
}
