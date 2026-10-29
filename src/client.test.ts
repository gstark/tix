import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { toTixError } from "./client.ts";
import { TixError } from "./errors.ts";

const URL = "https://a.convex.cloud";

describe("toTixError", () => {
  it("keeps the code and message of a server error", () => {
    const error = toTixError(new ConvexError({ code: "MAX_DEPTH", message: "Too deep" }), URL);
    expect(error).toBeInstanceOf(TixError);
    expect(error).toMatchObject({ code: "MAX_DEPTH", message: "Too deep" });
  });

  it("turns a fetch failure into NETWORK with the URL", () => {
    expect(toTixError(new TypeError("fetch failed"), URL)).toMatchObject({
      code: "NETWORK",
      message: `Cannot reach Convex at ${URL}`,
    });
  });

  it("passes other errors through", () => {
    const error = new Error("Server Error");
    expect(toTixError(error, URL)).toBe(error);
    const unshaped = new ConvexError("plain");
    expect(toTixError(unshaped, URL)).toBe(unshaped);
  });
});
