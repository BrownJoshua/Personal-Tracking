import request from "supertest";
import { describe, expect, it } from "vitest";
import { Session } from "../../src/modules/auth/session.model";
import { User } from "../../src/modules/users/user.model";
import { PASSWORD, app, bearer, createAdmin, registerUser, useDatabase } from "./helpers";

useDatabase();

describe("registration & login", () => {
  it("registers a USER with a profile and never stores the plain password", async () => {
    const { token } = await registerUser("Ann", "ann@example.com");
    const me = await request(app).get("/api/users/me").set(bearer(token));
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ name: "Ann", email: "ann@example.com", role: "USER", onboardingCompleted: false });
    expect(me.body.preferences.sharing).toEqual({ shareProgressWithAdmin: false, shareNutritionWithAdmin: false });
    expect(JSON.stringify(me.body)).not.toContain("passwordHash");

    const raw = await User.findOne({ email: "ann@example.com" }).select("+passwordHash").lean();
    expect(raw!.passwordHash).not.toContain(PASSWORD);
    expect(raw!.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a duplicate email and refuses role escalation", async () => {
    await registerUser("Ann", "ann@example.com");
    const dup = await request(app).post("/api/auth/register").send({ name: "A", email: "ANN@example.com", password: PASSWORD });
    expect(dup.status).toBe(409);
    const sneaky = await request(app)
      .post("/api/auth/register")
      .send({ name: "Eve", email: "eve@example.com", password: PASSWORD, role: "ADMIN" });
    expect(sneaky.status).toBe(201);
    expect(sneaky.body.user.role).toBe("USER");
  });

  it("gives the same error for an unknown email and a wrong password", async () => {
    await registerUser("Ann", "ann@example.com");
    const wrong = await request(app).post("/api/auth/login").send({ email: "ann@example.com", password: "wrong-password-1" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "wrong-password-1" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("web clients get the refresh token only as an httpOnly cookie", async () => {
    await registerUser("Ann", "ann@example.com");
    const res = await request(app).post("/api/auth/login").send({ email: "ann@example.com", password: PASSWORD, clientType: "web" });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeUndefined();
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });
});

describe("refresh tokens", () => {
  it("rotates refresh tokens and revokes the family when an old one is reused", async () => {
    const { refreshToken: first } = await registerUser("Ann", "ann@example.com");

    const r1 = await request(app).post("/api/auth/refresh").send({ refreshToken: first });
    expect(r1.status).toBe(200);
    const second = r1.body.refreshToken as string;
    expect(second).not.toBe(first);

    // Attacker replays the first (already rotated) token.
    const replay = await request(app).post("/api/auth/refresh").send({ refreshToken: first });
    expect(replay.status).toBe(401);

    // The legitimate, newer token is now revoked too.
    const r2 = await request(app).post("/api/auth/refresh").send({ refreshToken: second });
    expect(r2.status).toBe(401);
    expect(await Session.countDocuments({ revokedReason: "REUSE_DETECTED" })).toBeGreaterThan(0);
  });

  it("requires the client header when refreshing from a cookie", async () => {
    await registerUser("Ann", "ann@example.com");
    const login = await request(app).post("/api/auth/login").send({ email: "ann@example.com", password: PASSWORD, clientType: "web" });
    const cookie = login.headers["set-cookie"] as unknown as string[];
    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookie)).status).toBe(403);
    const ok = await request(app).post("/api/auth/refresh").set("Cookie", cookie).set("X-RecompTrack-Client", "web");
    expect(ok.status).toBe(200);
  });

  it("logout revokes the refresh token", async () => {
    const { refreshToken } = await registerUser("Ann", "ann@example.com");
    expect((await request(app).post("/api/auth/logout").send({ refreshToken })).status).toBe(204);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken })).status).toBe(401);
  });
});

describe("password reset & change", () => {
  it("forgot-password responds identically whether or not the email exists", async () => {
    await registerUser("Ann", "ann@example.com");
    const a = await request(app).post("/api/auth/forgot-password").send({ email: "ann@example.com" });
    const b = await request(app).post("/api/auth/forgot-password").send({ email: "nobody@example.com" });
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    expect(a.body).toEqual(b.body);
  });

  it("changing password signs out other devices", async () => {
    const phone = await registerUser("Ann", "ann@example.com");
    const laptop = await request(app).post("/api/auth/login").send({ email: "ann@example.com", password: PASSWORD });
    const res = await request(app)
      .post("/api/auth/change-password")
      .set(bearer(phone.token))
      .send({ currentPassword: PASSWORD, newPassword: "a-new-password-99" });
    expect(res.status).toBe(204);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: laptop.body.refreshToken })).status).toBe(401);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: phone.refreshToken })).status).toBe(200);
  });
});

describe("account administration", () => {
  it("deactivating a user blocks their existing access token and sessions", async () => {
    const admin = await createAdmin();
    const user = await registerUser("Ann", "ann@example.com");
    const res = await request(app).patch(`/api/admin/users/${user.id}`).set(bearer(admin.token)).send({ status: "DEACTIVATED" });
    expect(res.status).toBe(200);
    expect((await request(app).get("/api/users/me").set(bearer(user.token))).status).toBe(403);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: user.refreshToken })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: "ann@example.com", password: PASSWORD })).status).toBe(403);
  });

  it("an admin cannot demote or deactivate themselves, and TRAINER is not assignable yet", async () => {
    const admin = await createAdmin();
    const user = await registerUser("Ann", "ann@example.com");
    expect((await request(app).patch(`/api/admin/users/${admin.id}`).set(bearer(admin.token)).send({ role: "USER" })).status).toBe(403);
    expect((await request(app).patch(`/api/admin/users/${user.id}`).set(bearer(admin.token)).send({ role: "TRAINER" })).status).toBe(400);
  });

  it("admin user detail excludes private health data and is audited", async () => {
    const admin = await createAdmin();
    const user = await registerUser("Ann", "ann@example.com");
    await request(app)
      .post("/api/users/me/assessment")
      .set(bearer(user.token))
      .send({ profile: { dateOfBirth: "1990-05-01", heightCm: 170 }, currentWeightKg: 74 });
    const res = await request(app).get(`/api/admin/users/${user.id}`).set(bearer(admin.token));
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("1990-05-01");
    expect(text).not.toContain("74");
    const audit = await request(app).get(`/api/admin/audit-logs?entityId=${user.id}`).set(bearer(admin.token));
    expect(audit.body.items[0].action).toBe("USER_VIEWED");
  });
});
