import { ConvexError } from "convex/values";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "MAX_DEPTH"
  | "PARENT_CYCLE"
  | "CROSS_PROJECT"
  | "BLOCKER_CYCLE"
  | "OPEN_CHILDREN";

export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}
