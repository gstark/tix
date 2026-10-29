import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import { expectCode, setup } from "./test.setup";

describe("machine tokens", () => {
  it("returns a raw token with the tix_ prefix", async () => {
    const { token } = await setup();
    expect(token).toMatch(/^tix_[A-Za-z0-9_-]{43}$/);
  });

  it("stores only the SHA-256 hash", async () => {
    const { t, token } = await setup();
    const rows = await t.run((ctx) => ctx.db.query("machineTokens").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("lists tokens without hashes", async () => {
    const { t } = await setup();
    const list = await t.query(internal.tokens.list, {});
    expect(list).toEqual([{ name: "test", createdAt: expect.any(Number) }]);
  });

  it("rejects a second active token with the same name", async () => {
    const { t } = await setup();
    await expectCode(t.mutation(internal.tokens.create, { name: "test" }), "INVALID_INPUT");
  });

  it("allows a new token after a revoke", async () => {
    const { t } = await setup();
    await t.mutation(internal.tokens.revoke, { name: "test" });
    const token = await t.mutation(internal.tokens.create, { name: "test" });
    expect(await t.query(api.projects.list, { token })).toEqual([]);
  });

  it("throws NOT_FOUND when it revokes an unknown name", async () => {
    const { t } = await setup();
    await expectCode(t.mutation(internal.tokens.revoke, { name: "nope" }), "NOT_FOUND");
  });
});

describe("requireMachine", () => {
  it("accepts an active token", async () => {
    const { t, token } = await setup();
    expect(await t.query(api.projects.list, { token })).toEqual([]);
  });

  it("rejects an unknown token", async () => {
    const { t } = await setup();
    await expectCode(t.query(api.projects.list, { token: "tix_unknown" }), "UNAUTHORIZED");
  });

  it("rejects an empty token", async () => {
    const { t } = await setup();
    await expectCode(t.query(api.projects.list, { token: "" }), "UNAUTHORIZED");
  });

  it("rejects a revoked token", async () => {
    const { t, token } = await setup();
    await t.mutation(internal.tokens.revoke, { name: "test" });
    await expectCode(t.query(api.projects.list, { token }), "UNAUTHORIZED");
  });
});
