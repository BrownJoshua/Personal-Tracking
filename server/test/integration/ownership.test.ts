import request from "supertest";
import { describe, expect, it } from "vitest";
import { BodyMeasurement } from "../../src/modules/measurements/bodyMeasurement.model";
import { UserGoal } from "../../src/modules/users/userGoal.model";
import { app, bearer, registerUser, useDatabase } from "./helpers";

useDatabase();

describe("user isolation", () => {
  it("User B cannot read, list or delete User A's measurements by changing the id", async () => {
    const a = await registerUser("Ann", "ann@example.com");
    const b = await registerUser("Ben", "ben@example.com");

    const created = await request(app).post("/api/measurements").set(bearer(a.token)).send({ measurements: { weightKg: 74 } });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    expect((await request(app).get(`/api/measurements/${id}`).set(bearer(a.token))).status).toBe(200);
    expect((await request(app).get(`/api/measurements/${id}`).set(bearer(b.token))).status).toBe(404);
    expect((await request(app).delete(`/api/measurements/${id}`).set(bearer(b.token))).status).toBe(404);
    expect((await request(app).get("/api/measurements").set(bearer(b.token))).body.items).toHaveLength(0);
    expect(await BodyMeasurement.countDocuments()).toBe(1);
  });

  it("ignores a userId smuggled into the body", async () => {
    const a = await registerUser("Ann", "ann@example.com");
    const b = await registerUser("Ben", "ben@example.com");
    const res = await request(app)
      .post("/api/measurements")
      .set(bearer(b.token))
      .send({ userId: a.id, measurements: { weightKg: 90 } });
    expect(res.status).toBe(400); // strict schema: unknown field rejected
    expect(await BodyMeasurement.countDocuments({ userId: a.id })).toBe(0);
  });
});

describe("profile & history", () => {
  it("assessment stores weight as a measurement, and goal changes keep history", async () => {
    const a = await registerUser("Ann", "ann@example.com");
    const res = await request(app)
      .post("/api/users/me/assessment")
      .set(bearer(a.token))
      .send({
        profile: { dateOfBirth: "1992-03-10", heightCm: 172, sex: "FEMALE", activityLevel: "MODERATE", trainingExperience: "BEGINNER" },
        currentWeightKg: 74,
        waistCm: 82,
        goal: { goalType: "RECOMPOSITION", targetWeightKg: 70 },
      });
    expect(res.status).toBe(200);
    expect(res.body.user.onboardingCompleted).toBe(true);
    expect(res.body.profile.heightCm).toBe(172);
    expect(res.body.goal.goalType).toBe("RECOMPOSITION");

    // A later weigh-in does not overwrite the first one.
    await request(app).post("/api/measurements").set(bearer(a.token)).send({ measurements: { weightKg: 73.4 } });
    const list = await request(app).get("/api/measurements").set(bearer(a.token));
    expect(list.body.items.map((m: { measurements: { weightKg?: number } }) => m.measurements.weightKg)).toEqual([73.4, 74]);
    const summary = await request(app).get("/api/measurements/summary").set(bearer(a.token));
    expect(summary.body.latestWeight.valueKg).toBe(73.4);
    expect(summary.body.weightSevenDayAverageKg).toBe(73.7);
    expect(summary.body.latestWaist.valueCm).toBe(82);

    await request(app).put("/api/users/me/goal").set(bearer(a.token)).send({ goalType: "FAT_LOSS" });
    expect(await UserGoal.countDocuments({ userId: a.id })).toBe(2);
    expect(await UserGoal.countDocuments({ userId: a.id, status: "ACTIVE" })).toBe(1);
  });

  it("partial preference updates do not wipe sibling settings", async () => {
    const a = await registerUser("Ann", "ann@example.com");
    await request(app).patch("/api/users/me/preferences").set(bearer(a.token)).send({ sharing: { shareProgressWithAdmin: true } });
    const res = await request(app).patch("/api/users/me/preferences").set(bearer(a.token)).send({ sharing: { shareNutritionWithAdmin: true } });
    expect(res.body.preferences.sharing).toEqual({ shareProgressWithAdmin: true, shareNutritionWithAdmin: true });
  });

  it("rejects measurements in the future", async () => {
    const a = await registerUser("Ann", "ann@example.com");
    const future = new Date(Date.now() + 86400000).toISOString();
    const res = await request(app).post("/api/measurements").set(bearer(a.token)).send({ recordedAt: future, measurements: { weightKg: 70 } });
    expect(res.status).toBe(400);
  });
});
