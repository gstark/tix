import { convexTest } from "convex-test";
import { expect } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

export const PROJECT = "github.com/acme/api";

const modules = import.meta.glob(["./**/*.*s", "!./**/*.*.*s"]);

export async function setup() {
  const t = convexTest(schema, modules);
  const token = await t.mutation(internal.tokens.create, { name: "test" });
  return { t, token };
}

export async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ data: { code } });
}
