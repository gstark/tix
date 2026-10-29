import type { ErrorCode } from "../convex/errors.ts";

/** Server codes, plus the codes that only the client makes. */
export type TixErrorCode = ErrorCode | "USAGE" | "CONFIG" | "NETWORK";

export class TixError extends Error {
  readonly code: TixErrorCode;

  constructor(code: TixErrorCode, message: string) {
    super(message);
    this.name = "TixError";
    this.code = code;
  }
}

/** Maps an error code to the CLI exit code in the spec. */
export function exitCodeOf(code: TixErrorCode): 1 | 2 | 3 {
  if (code === "UNAUTHORIZED" || code === "CONFIG") return 2;
  if (code === "NETWORK") return 3;
  return 1;
}
