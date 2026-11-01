import request from "supertest";
import { describe, expect, it } from "vitest";
import { addDays, weekStart } from "@recomptrack/shared";
import { BodyMeasurement } from "../../src/modules/measurements/bodyMeasurement.model";
import { app, bearer, createAdmin, registerUser, seedLookups, useDatabase } from "./helpers";

useDatabase();

const today = new Date().toISOString().slice(0, 10); // test users use the UTC time zone
const monday = weekStart(today);

async function benchExercise(adminToken: string) {
  const { chestId } = await seedLookups();
  const r = await request(app).post("/api/admin/exercises").set(bearer(adminToken)).send({
    code: "CHEST001", name: "Bench Press", primaryMuscleId: chestId, exerciseType: "COMPOUND", movementPattern: "HORIZONTAL_PUSH",
    defaultSets: 3, defaultRepMin: 8, defaultRepMax: 10, defaultRestSeconds: 120,
  });
  return r.body.id as string;
}

async function logWorkout(token: string, exerciseId: string, weightKg: number, discomfort = false) {
  const s = await request(app).post("/api/workouts/sessions").set(bearer(token)).send({});
  const added = await request(app).post(`/api/workouts/sessions/${s.body.id}/exercises`).set(bearer(token)).send({ exerciseId });
  await request(app)
    .put(`/api/workouts/sessions/${s.body.id}/exercises/${added.body.exercises[0].id}`)
    .set(bearer(token))
    .send({
      sets: [1, 2, 3].map(() => ({ weightKg, reps: 8, setType: "WORKING", completed: true })),
      ...(discomfort ? { discomfort: { reported: true, location: "shoulder", severity: 3 } } : {}),
    });
  const done = await request(app).post(`/api/workouts/sessions/${s.body.id}/complete`).set(bearer(token));
  expect(done.status).toBe(200);
  return done.body;
}

describe("member reports", () => {
  it("strength progression follows logged sessions", async () => {
    const admin = await createAdmin();
    const bench = await benchExercise(admin.token);
    const a = await registerUser("Ann", "ann@example.com");
    await logWorkout(a.token, bench, 40);
    await logWorkout(a.token, bench, 45);

    const list = await request(app).get("/api/reports/strength").set(bearer(a.token));
    expect(list.body[0]).toMatchObject({ exerciseName: "Bench Press", sessions: 2, firstOneRepMax: 50.7, latestOneRepMax: 57 });
    const series = await request(app).get(`/api/reports/strength/${bench}`).set(bearer(a.token));
    expect(series.body.points.map((p: { heaviestKg: number }) => p.heaviestKg)).toEqual([40, 45]);

    // Another member has no history for it.
    const b = await registerUser("Ben", "ben@example.com");
    expect((await request(app).get(`/api/reports/strength/${bench}`).set(bearer(b.token))).status).toBe(404);
    expect((await request(app).get("/api/reports/strength").set(bearer(b.token))).body).toEqual([]);
  });

  it("body trend gives a 7-day average and weekly rate", async () => {
    const a = await registerUser("Ann", "ann@example.com");
    const base = Date.now();
    await BodyMeasurement.insertMany(
      [80, 79.8, 79.6, 79.4, 79.2, 79.0, 78.8, 78.6].map((w, i) => ({
        userId: a.id,
        recordedAt: new Date(base - (7 - i) * 86_400_000),
        measurements: { weightKg: w },
      })),
    );
    const r = await request(app).get("/api/reports/body?days=30").set(bearer(a.token));
    expect(r.status).toBe(200);
    expect(r.body.weight).toHaveLength(8);
    expect(r.body.weeklyRateKg).toBe(-1.4);
    const last = r.body.weight.at(-1);
    expect(last.average7d).toBeCloseTo(79.2, 1);
  });

  it("weekly report averages logged days only and produces recommendations", async () => {
    const admin = await createAdmin();
    const bench = await benchExercise(admin.token);
    const chicken = await request(app).post("/api/admin/foods").set(bearer(admin.token)).send({
      name: "Chicken breast", kind: "GENERIC", category: "POULTRY", preparation: "COOKED", source: "REFERENCE_DATA",
      nutrition: { calories: 165, protein: 31, carbohydrates: 0, fat: 3.6, fibre: 0 },
    });
    const a = await registerUser("Ann", "ann@example.com");
    await request(app).post("/api/nutrition/logs").set(bearer(a.token)).send({ foodId: chicken.body.id, quantity: 200, mealType: "LUNCH", localDate: monday });
    await request(app).post("/api/nutrition/logs").set(bearer(a.token)).send({ foodId: chicken.body.id, quantity: 100, mealType: "DINNER", localDate: monday });
    await logWorkout(a.token, bench, 40, true);

    const r = await request(app).get(`/api/reports/weekly?week=${today}`).set(bearer(a.token));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ weekStart: monday, weekEnd: addDays(monday, 6) });
    expect(r.body.nutrition).toMatchObject({ daysLogged: 1, avgCalories: 495, avgProtein: 93 });
    expect(r.body.nutrition.days).toHaveLength(7);
    expect(r.body.training).toMatchObject({ sessions: 1, workingSets: 3, discomfortReports: 1 });
    // Sparse data → ask for more logging rather than judging intake.
    expect(r.body.recommendations.map((x: { kind: string }) => x.kind)).toContain("LOGGING");
    expect(r.body.recommendations.some((x: { kind: string }) => x.kind === "NUTRITION")).toBe(false);
  });
});

describe("admin analytics & consent", () => {
  it("platform analytics are aggregate counts", async () => {
    const admin = await createAdmin();
    const bench = await benchExercise(admin.token);
    const a = await registerUser("Ann", "ann@example.com");
    await logWorkout(a.token, bench, 40);
    const r = await request(app).get("/api/admin/analytics?weeks=4").set(bearer(admin.token));
    expect(r.status).toBe(200);
    expect(r.body.weeks).toHaveLength(4);
    expect(r.body.weeks.at(-1)).toMatchObject({ workoutsCompleted: 1, activeUsers: 1 });
    expect(r.body.topExercises[0]).toMatchObject({ exerciseName: "Bench Press", users: 1 });
    expect(r.body.totals).toMatchObject({ members: 1, membersTrainingThisWeek: 1 });
    expect((await request(app).get("/api/admin/analytics").set(bearer(a.token))).status).toBe(403);
  });

  it("a member's report needs their consent, shows only shared sections, and is audited", async () => {
    const admin = await createAdmin();
    const a = await registerUser("Ann", "ann@example.com");
    const denied = await request(app).get(`/api/admin/users/${a.id}/report`).set(bearer(admin.token));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("CONSENT_REQUIRED");

    await request(app).patch("/api/users/me/preferences").set(bearer(a.token)).send({ sharing: { shareNutritionWithAdmin: true } });
    const r = await request(app).get(`/api/admin/users/${a.id}/report`).set(bearer(admin.token));
    expect(r.status).toBe(200);
    expect(r.body.consent).toEqual({ progress: false, nutrition: true });
    expect(r.body.report.nutrition).not.toBeNull();
    expect(r.body.report.training).toBeNull();
    expect(r.body.report.body).toBeNull();
    expect(r.body.bodyTrend).toBeNull();

    const audit = await request(app).get(`/api/admin/audit-logs?entityId=${a.id}`).set(bearer(admin.token));
    expect(audit.body.items[0].action).toBe("USER_REPORT_VIEWED");
  });
});
