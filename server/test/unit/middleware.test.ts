import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PERMISSIONS } from "@recomptrack/shared";
import { createApp } from "../../src/app";
import { authenticate } from "../../src/middleware/authenticate";
import { authorize } from "../../src/middleware/authorize";
import { errorHandler } from "../../src/middleware/errorHandler";
import { validate } from "../../src/middleware/validate";
import { signAccessToken, verifyAccessToken } from "../../src/modules/auth/tokens";
import { User } from "../../src/modules/users/user.model";
import jwt from "jsonwebtoken";

const USER_ID = "64b000000000000000000001";

/** Make `User.findById(...).select(...).lean()` resolve to the given user without a database. */
function mockUser(user: { role: string; status: string } | null) {
  return vi.spyOn(User, "findById").mockReturnValue({
    select: () => ({ lean: async () => (user ? { _id: USER_ID, ...user } : null) }),
  } as never);
}

const token = (role = "USER") => signAccessToken({ sub: USER_ID, sid: "64b0000000000000000000aa", role: role as never });

afterEach(() => vi.restoreAllMocks());

describe("access tokens", () => {
  it("round-trips claims", () => {
    expect(verifyAccessToken(token())).toMatchObject({ sub: USER_ID, role: "USER" });
  });
  it("rejects tampered, foreign-secret and alg=none tokens", () => {
    const t = token();
    expect(verifyAccessToken(t.slice(0, -2) + "xx")).toBeNull();
    expect(verifyAccessToken(jwt.sign({ sub: USER_ID, sid: "x" }, "another-secret-another-secret-123456"))).toBeNull();
    const none = jwt.sign({ sub: USER_ID, sid: "x", role: "ADMIN" }, "", { algorithm: "none" as never });
    expect(verifyAccessToken(none)).toBeNull();
  });
});

describe("route protection (no database)", () => {
  const app = createApp();

  it("rejects personal-data routes without a token", async () => {
    for (const path of ["/api/users/me", "/api/measurements", "/api/exercises", "/api/admin/dashboard"]) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("forbids a USER from admin routes", async () => {
    mockUser({ role: "USER", status: "ACTIVE" });
    for (const [method, path] of [
      ["get", "/api/admin/dashboard"],
      ["get", "/api/admin/users"],
      ["post", "/api/admin/exercises"],
      ["post", "/api/admin/foods"],
      ["delete", "/api/admin/exercises/64b000000000000000000002"],
    ] as const) {
      const res = await request(app)[method](path).set("Authorization", `Bearer ${token()}`).send({});
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it("uses the role from the database, not the token", async () => {
    // Token claims ADMIN, but the account was demoted to USER.
    mockUser({ role: "USER", status: "ACTIVE" });
    const res = await request(app).get("/api/admin/dashboard").set("Authorization", `Bearer ${token("ADMIN")}`);
    expect(res.status).toBe(403);
  });

  it("blocks deactivated accounts immediately", async () => {
    mockUser({ role: "USER", status: "DEACTIVATED" });
    const res = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token()}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });

  it("rejects tokens for users that no longer exist", async () => {
    mockUser(null);
    const res = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token()}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 JSON for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("validates input before touching the database", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "", email: "bad", password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(["name", "email", "password"]),
    );
  });

  it("rejects malformed JSON", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
  });

  it("parses query strings flat, so ?status[$ne]=x can never become a MongoDB operator", async () => {
    expect(app.get("query parser")).toBe("simple");
    const { adminUserListQuerySchema } = await import("@recomptrack/shared");
    const parsed = adminUserListQuerySchema.parse({ "status[$ne]": "ACTIVE" });
    expect(parsed).not.toHaveProperty("status");
    expect(adminUserListQuerySchema.safeParse({ status: { $ne: "ACTIVE" } }).success).toBe(false);
  });
});

describe("validate / authorize helpers", () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.valid = {};
    req.auth = { userId: USER_ID, role: "USER", sessionId: "s", permissions: [PERMISSIONS.CATALOGUE_READ] };
    next();
  });
  app.post("/v", validate({ body: z.object({ n: z.coerce.number() }).strict() }), (req, res) => {
    res.json({ body: req.valid.body, raw: req.body });
  });
  app.get("/admin-only", authorize(PERMISSIONS.FOODS_MANAGE), (_req, res) => res.json({ ok: true }));
  app.get("/catalogue", authorize(PERMISSIONS.CATALOGUE_READ), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  it("exposes parsed values and rejects unknown keys", async () => {
    expect((await request(app).post("/v").send({ n: "5" })).body.body).toEqual({ n: 5 });
    expect((await request(app).post("/v").send({ n: 1, userId: "someone-else" })).status).toBe(400);
  });
  it("checks permissions", async () => {
    expect((await request(app).get("/admin-only")).status).toBe(403);
    expect((await request(app).get("/catalogue")).status).toBe(200);
  });
});
