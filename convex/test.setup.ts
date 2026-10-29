import { convexTest } from "convex-test";
import { expect } from "vitest";
import { api, internal } from "./_generated/api";
import type { ErrorCode } from "./errors";
import schema from "./schema";

export const PROJECT = "github.com/acme/api";
export const OTHER_PROJECT = "github.com/acme/web";

// Vite 8 does not support extglob, so the exclusion is a negated pattern.
const modules = import.meta.glob(["./**/*.*s", "!./**/*.*.*s"]);

type CreateOptions = {
  parent?: string;
  priority?: number;
  description?: string;
  projectKey?: string;
};

export async function setup() {
  const t = convexTest(schema, modules);
  const token = await t.mutation(internal.tokens.create, { name: "test" });
  const create = (name: string, options: CreateOptions = {}) =>
    t.mutation(api.tasks.create, { token, projectKey: PROJECT, name, ...options });
  return { t, token, create };
}

export async function expectCode(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toMatchObject({ data: { code } });
}
