import request from "supertest";
import { describe, expect, it } from "vitest";
import { ExerciseLog } from "../../src/modules/workouts/workout.models";
import { FoodLog } from "../../src/modules/nutrition/nutrition.models";
import { app, bearer, createAdmin, registerUser, seedLookups, useDatabase } from "./helpers";

useDatabase();

async function setupCatalogue(adminToken: string) {
  const { chestId, tricepsId, barbellId } = await seedLookups();
  const mk = (code: string, name: string) =>
    request(app).post("/api/admin/exercises").set(bearer(adminToken)).send({
      code, name, primaryMuscleId: chestId, secondaryMuscleIds: [tricepsId], equipmentId: barbellId,
      exerciseType: "COMPOUND", movementPattern: "HORIZONTAL_PUSH", defaultSets: 3, defaultRepMin: 8, defaultRepMax: 10, defaultRestSeconds: 120,
    });
  const bench = (await mk("CHEST001", "Bench Press")).body.id as string;
  const incline = (await mk("CHEST002", "Incline Press")).body.id as string;
  const chicken = (
    await request(app).post("/api/admin/foods").set(bearer(adminToken)).send({
      name: "Chicken breast", kind: "GENERIC", category: "POULTRY", preparation: "COOKED", source: "REFERENCE_DATA",
      nutrition: { calories: 165, protein: 31, carbohydrates: 0, fat: 3.6, fibre: 0 },
    })
  ).body.id as string;
  const rice = (
    await request(app).post("/api/admin/foods").set(bearer(adminToken)).send({
      name: "White rice", kind: "GENERIC", category: "GRAINS", preparation: "COOKED", source: "REFERENCE_DATA",
      nutrition: { calories: 130, protein: 2.7, carbohydrates: 28.2, fat: 0.3, fibre: 0.4 },
    })
  ).body.id as string;
  return { bench, incline, chicken, rice };
}

const planBody = (bench: string, incline: string, sets = 3) => ({
  name: "Upper / Lower – 4 Days",
  goalType: "RECOMPOSITION",
  experienceLevel: "BEGINNER",
  durationWeeks: 8,
  days: [
    { dayName: "Upper A", exercises: [{ exerciseId: bench, sets, repMin: 8, repMax: 10, restSeconds: 120 }] },
    { dayName: "Upper B", exercises: [{ exerciseId: incline, sets: 3, repMin: 8, repMax: 12, restSeconds: 90 }] },
  ],
});

const completedSets = (weightKg: number, reps: number, n = 3) =>
  Array.from({ length: n }, () => ({ weightKg, reps, setType: "WORKING", completed: true }));

describe("workout plans: versions and assignment", () => {
  it("admin builds, publishes and assigns a plan; editing creates a new version and the user keeps theirs", async () => {
    const admin = await createAdmin();
    const { bench, incline } = await setupCatalogue(admin.token);
    const a = await registerUser("Ann", "ann@example.com");
    const b = await registerUser("Ben", "ben@example.com");

    const draft = await request(app).post("/api/admin/workout-plans").set(bearer(admin.token)).send(planBody(bench, incline));
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({ status: "DRAFT", version: 1, daysPerWeek: 2 });

    // Drafts can't be assigned.
    const early = await request(app).post("/api/admin/assignments").set(bearer(admin.token)).send({ userId: a.id, workoutPlanId: draft.body.id, startDate: "2026-01-01" });
    expect(early.status).toBe(409);

    const v1 = await request(app).post(`/api/admin/workout-plans/${draft.body.id}/publish`).set(bearer(admin.token));
    expect(v1.body.status).toBe("PUBLISHED");
    expect((await request(app).put(`/api/admin/workout-plans/${v1.body.id}`).set(bearer(admin.token)).send(planBody(bench, incline, 4))).status).toBe(409);

    const assign = await request(app).post("/api/admin/assignments").set(bearer(admin.token)).send({ userId: a.id, workoutPlanId: v1.body.id, startDate: "2026-01-01" });
    expect(assign.status).toBe(201);

    const mine = await request(app).get("/api/workouts/plan").set(bearer(a.token));
    expect(mine.body.plan).toMatchObject({ name: "Upper / Lower – 4 Days", version: 1 });
    expect((await request(app).get("/api/workouts/plan").set(bearer(b.token))).body).toBeNull();

    // Revise to v2 with 4 sets of bench, publish.
    const v2 = await request(app).post(`/api/admin/workout-plans/${v1.body.id}/revise`).set(bearer(admin.token));
    expect(v2.body).toMatchObject({ version: 2, status: "DRAFT" });
    await request(app).put(`/api/admin/workout-plans/${v2.body.id}`).set(bearer(admin.token)).send(planBody(bench, incline, 4));
    await request(app).post(`/api/admin/workout-plans/${v2.body.id}/publish`).set(bearer(admin.token));

    const after = await request(app).get("/api/workouts/plan").set(bearer(a.token));
    expect(after.body.plan.version).toBe(1);
    expect(after.body.plan.days[0].exercises[0].sets).toBe(3);
    expect(after.body.assignment.latestPublishedVersion).toBe(2);
    expect((await request(app).get(`/api/admin/workout-plans/${v1.body.id}`).set(bearer(admin.token))).body.status).toBe("ARCHIVED");
  });
});

describe("workout sessions", () => {
  async function assigned() {
    const admin = await createAdmin();
    const cat = await setupCatalogue(admin.token);
    const a = await registerUser("Ann", "ann@example.com");
    const plan = await request(app).post("/api/admin/workout-plans").set(bearer(admin.token)).send(planBody(cat.bench, cat.incline));
    await request(app).post(`/api/admin/workout-plans/${plan.body.id}/publish`).set(bearer(admin.token));
    await request(app).post("/api/admin/assignments").set(bearer(admin.token)).send({ userId: a.id, workoutPlanId: plan.body.id, startDate: "2026-01-01" });
    return { admin, a, cat, planId: plan.body.id as string };
  }

  it("logs a workout from today's plan day, records PRs, and freezes it when completed", async () => {
    const { a } = await assigned();
    const today = await request(app).get("/api/workouts/today").set(bearer(a.token));
    expect(today.body).toMatchObject({ reason: "ROTATION", day: { dayName: "Upper A" } });

    const s1 = await request(app).post("/api/workouts/sessions").set(bearer(a.token)).send({ workoutPlanDayId: today.body.day.id });
    expect(s1.status).toBe(201);
    expect(s1.body.exercises[0]).toMatchObject({ exerciseName: "Bench Press", planned: { sets: 3, repMin: 8, repMax: 10 } });
    expect(s1.body.exercises[0].sets).toHaveLength(3);

    // Only one open workout at a time.
    expect((await request(app).post("/api/workouts/sessions").set(bearer(a.token)).send({})).status).toBe(409);

    const logId = s1.body.exercises[0].id;
    await request(app).put(`/api/workouts/sessions/${s1.body.id}/exercises/${logId}`).set(bearer(a.token)).send({
      sets: [{ weightKg: 20, reps: 10, setType: "WARM_UP", completed: true }, ...completedSets(40, 10)],
      notes: "Felt good",
    });
    const done = await request(app).post(`/api/workouts/sessions/${s1.body.id}/complete`).set(bearer(a.token));
    expect(done.status).toBe(200);
    expect(done.body.summary).toMatchObject({ exercises: 1, workingSets: 3, reps: 30, volumeKg: 1200, personalRecords: [] });
    expect((await request(app).put(`/api/workouts/sessions/${s1.body.id}/exercises/${logId}`).set(bearer(a.token)).send({ sets: [] })).status).toBe(409);

    // Next session: rotation moves to Upper B; a free workout with heavier bench is a PR.
    expect((await request(app).get("/api/workouts/today").set(bearer(a.token))).body.reason).toBe("DONE_TODAY");
    const s2 = await request(app).post("/api/workouts/sessions").set(bearer(a.token)).send({});
    const added = await request(app).post(`/api/workouts/sessions/${s2.body.id}/exercises`).set(bearer(a.token)).send({ exerciseId: s1.body.exercises[0].exerciseId });
    expect(added.body.exercises[0].sets[0].weightKg).toBe(40); // prefilled from last time
    expect(added.body.exercises[0].previous).toHaveLength(4);
    await request(app).put(`/api/workouts/sessions/${s2.body.id}/exercises/${added.body.exercises[0].id}`).set(bearer(a.token)).send({ sets: completedSets(45, 8) });
    const done2 = await request(app).post(`/api/workouts/sessions/${s2.body.id}/complete`).set(bearer(a.token));
    expect(done2.body.summary.personalRecords.map((p: { kind: string }) => p.kind).sort()).toEqual(["ESTIMATED_1RM", "HEAVIEST_WEIGHT"]);

    const hist = await request(app).get("/api/workouts/sessions").set(bearer(a.token));
    expect(hist.body.total).toBe(2);
  });

  it("refuses to complete an empty workout, and pause time is excluded", async () => {
    const { a } = await assigned();
    const s = await request(app).post("/api/workouts/sessions").set(bearer(a.token)).send({});
    expect((await request(app).post(`/api/workouts/sessions/${s.body.id}/pause`).set(bearer(a.token))).body.status).toBe("PAUSED");
    expect((await request(app).post(`/api/workouts/sessions/${s.body.id}/resume`).set(bearer(a.token))).body.status).toBe("IN_PROGRESS");
    expect((await request(app).post(`/api/workouts/sessions/${s.body.id}/complete`).set(bearer(a.token))).status).toBe(400);
    expect((await request(app).post(`/api/workouts/sessions/${s.body.id}/discard`).set(bearer(a.token))).status).toBe(204);
  });

  it("isolates users: another user's session and plan days are not reachable", async () => {
    const { a } = await assigned();
    const b = await registerUser("Ben", "ben@example.com");
    const today = await request(app).get("/api/workouts/today").set(bearer(a.token));
    // Ben cannot start Ann's plan day.
    expect((await request(app).post("/api/workouts/sessions").set(bearer(b.token)).send({ workoutPlanDayId: today.body.day.id })).status).toBe(404);
    const s = await request(app).post("/api/workouts/sessions").set(bearer(a.token)).send({ workoutPlanDayId: today.body.day.id });
    expect((await request(app).get(`/api/workouts/sessions/${s.body.id}`).set(bearer(b.token))).status).toBe(404);
    expect((await request(app).post(`/api/workouts/sessions/${s.body.id}/discard`).set(bearer(b.token))).status).toBe(404);
    expect(
      (await request(app).put(`/api/workouts/sessions/${s.body.id}/exercises/${s.body.exercises[0].id}`).set(bearer(b.token)).send({ sets: [] })).status,
    ).toBe(404);
  });

  it("archiving an exercise keeps logged history readable", async () => {
    const { a, admin, cat } = await assigned();
    const today = await request(app).get("/api/workouts/today").set(bearer(a.token));
    const s = await request(app).post("/api/workouts/sessions").set(bearer(a.token)).send({ workoutPlanDayId: today.body.day.id });
    await request(app).put(`/api/workouts/sessions/${s.body.id}/exercises/${s.body.exercises[0].id}`).set(bearer(a.token)).send({ sets: completedSets(40, 10) });
    await request(app).post(`/api/workouts/sessions/${s.body.id}/complete`).set(bearer(a.token));
    await request(app).post(`/api/admin/exercises/${cat.bench}/archive`).set(bearer(admin.token));
    const detail = await request(app).get(`/api/workouts/sessions/${s.body.id}`).set(bearer(a.token));
    expect(detail.body.exercises[0]).toMatchObject({ exerciseName: "Bench Press" });
    expect(detail.body.exercises[0].sets[0]).toMatchObject({ weightKg: 40, reps: 10 });
    expect(await ExerciseLog.countDocuments()).toBe(1);
  });
});

describe("food diary", () => {
  it("logs with a snapshot, recomputes quantity from the snapshot, and isolates users", async () => {
    const admin = await createAdmin();
    const { chicken } = await setupCatalogue(admin.token);
    const a = await registerUser("Ann", "ann@example.com");
    const b = await registerUser("Ben", "ben@example.com");

    const log = await request(app).post("/api/nutrition/logs").set(bearer(a.token)).send({ foodId: chicken, quantity: 150, mealType: "LUNCH", localDate: "2026-11-01" });
    expect(log.status).toBe(201);
    expect(log.body.nutrition).toMatchObject({ calories: 247.5, protein: 46.5 });

    // Admin corrects the food; Ann's past log is unchanged and edits use the old basis.
    await request(app).patch(`/api/admin/foods/${chicken}`).set(bearer(admin.token)).send({ nutrition: { calories: 200, protein: 31, carbohydrates: 0, fat: 3.6, fibre: 0 } });
    const edited = await request(app).patch(`/api/nutrition/logs/${log.body.id}`).set(bearer(a.token)).send({ quantity: 200 });
    expect(edited.body.nutrition.calories).toBe(330);

    const day = await request(app).get("/api/nutrition/diary?date=2026-11-01").set(bearer(a.token));
    expect(day.body.meals.LUNCH.entries).toHaveLength(1);
    expect(day.body.totals.calories).toBe(330);
    expect((await request(app).get("/api/nutrition/diary?date=2026-11-01").set(bearer(b.token))).body.totals.calories).toBe(0);
    expect((await request(app).delete(`/api/nutrition/logs/${log.body.id}`).set(bearer(b.token))).status).toBe(404);
    expect((await request(app).patch(`/api/nutrition/logs/${log.body.id}`).set(bearer(b.token)).send({ quantity: 1 })).status).toBe(404);

    const hist = await request(app).get("/api/nutrition/history?from=2026-10-30&to=2026-11-01").set(bearer(a.token));
    expect(hist.body.map((d: { entries: number }) => d.entries)).toEqual([0, 0, 1]);
  });

  it("custom foods are private and saved meals can be re-logged", async () => {
    const admin = await createAdmin();
    const { rice } = await setupCatalogue(admin.token);
    const a = await registerUser("Ann", "ann@example.com");
    const b = await registerUser("Ben", "ben@example.com");
    const shake = await request(app).post("/api/nutrition/custom-foods").set(bearer(a.token)).send({
      name: "Home protein shake", servingBasis: 100, servingUnit: "MILLILITRE", nutrition: { calories: 60, protein: 10, carbohydrates: 3, fat: 1 },
    });
    expect(shake.status).toBe(201);
    expect((await request(app).post("/api/nutrition/logs").set(bearer(b.token)).send({ customFoodId: shake.body.id, quantity: 300, mealType: "SNACK" })).status).toBe(404);

    await request(app).post("/api/nutrition/logs").set(bearer(a.token)).send({ customFoodId: shake.body.id, quantity: 300, mealType: "BREAKFAST", localDate: "2026-11-01" });
    await request(app).post("/api/nutrition/logs").set(bearer(a.token)).send({ foodId: rice, quantity: 100, mealType: "BREAKFAST", localDate: "2026-11-01" });
    const saved = await request(app).post("/api/nutrition/saved-meals/from-diary").set(bearer(a.token)).send({ name: "Usual breakfast", localDate: "2026-11-01", mealType: "BREAKFAST" });
    expect(saved.body.totals.calories).toBe(310);
    const relog = await request(app).post(`/api/nutrition/saved-meals/${saved.body.id}/log`).set(bearer(a.token)).send({ mealType: "BREAKFAST", localDate: "2026-11-02" });
    expect(relog.body).toEqual({ logged: 2, skipped: 0 });
    expect((await request(app).post(`/api/nutrition/saved-meals/${saved.body.id}/log`).set(bearer(b.token)).send({ mealType: "LUNCH" })).status).toBe(404);
  });
});

describe("meal templates", () => {
  it("totals come from ingredients; assigned meals can be logged by the user", async () => {
    const admin = await createAdmin();
    const { chicken, rice } = await setupCatalogue(admin.token);
    const a = await registerUser("Ann", "ann@example.com");
    const t = await request(app).post("/api/admin/meal-templates").set(bearer(admin.token)).send({
      name: "Chicken and rice", mealType: "LUNCH", ingredients: [{ foodId: chicken, quantity: 150 }, { foodId: rice, quantity: 200 }],
    });
    expect(t.status).toBe(201);
    expect(t.body.totalNutrition.calories).toBe(507.5);
    expect((await request(app).post("/api/admin/meal-assignments").set(bearer(admin.token)).send({ userId: a.id, mealTemplateId: t.body.id, startDate: "2026-11-01" })).status).toBe(409);
    await request(app).post(`/api/admin/meal-templates/${t.body.id}/publish`).set(bearer(admin.token));
    expect((await request(app).post("/api/admin/meal-assignments").set(bearer(admin.token)).send({ userId: a.id, mealTemplateId: t.body.id, startDate: "2026-11-01" })).status).toBe(201);

    const plans = await request(app).get("/api/nutrition/meal-plans").set(bearer(a.token));
    expect(plans.body[0].mealTemplate.name).toBe("Chicken and rice");
    const logged = await request(app).post(`/api/nutrition/meal-plans/${plans.body[0].id}/log`).set(bearer(a.token)).send({ mealType: "LUNCH", localDate: "2026-11-01", portion: 0.5 });
    expect(logged.body).toEqual({ logged: 2, skipped: 0 });
    expect(await FoodLog.countDocuments({ mealTemplateId: t.body.id })).toBe(2);
    expect((await request(app).delete(`/api/admin/meal-templates/${t.body.id}`).set(bearer(admin.token))).status).toBe(409);
  });
});

describe("nutrition targets", () => {
  it("calculates from the profile, updates with weight, and respects an admin override", async () => {
    const admin = await createAdmin();
    const a = await registerUser("Ann", "ann@example.com");
    const incomplete = await request(app).get("/api/nutrition/targets").set(bearer(a.token));
    expect(incomplete.body.target).toBeNull();
    expect(incomplete.body.missing).toEqual(expect.arrayContaining(["dateOfBirth", "weightKg", "goalType"]));

    await request(app).post("/api/users/me/assessment").set(bearer(a.token)).send({
      profile: { dateOfBirth: "1990-01-01", heightCm: 170, sex: "FEMALE", activityLevel: "MODERATE" },
      currentWeightKg: 70,
      goal: { goalType: "FAT_LOSS" },
    });
    const t1 = (await request(app).get("/api/nutrition/targets").set(bearer(a.token))).body.target;
    expect(t1.method).toBe("CALCULATED");
    expect(t1.protein).toBe(140);

    await request(app).post("/api/measurements").set(bearer(a.token)).send({ measurements: { weightKg: 65 } });
    const t2 = (await request(app).get("/api/nutrition/targets").set(bearer(a.token))).body.target;
    expect(t2.protein).toBe(130);

    // Admin sees the numbers but not the breakdown (age/weight) without consent.
    const plans = await request(app).get(`/api/admin/users/${a.id}/plans`).set(bearer(admin.token));
    expect(plans.body.target.breakdown).toBeNull();

    await request(app).put(`/api/admin/users/${a.id}/targets`).set(bearer(admin.token)).send({ calories: 1800, protein: 150, carbohydrates: 160, fat: 60, fibre: 30 });
    await request(app).post("/api/measurements").set(bearer(a.token)).send({ measurements: { weightKg: 64 } });
    const t3 = (await request(app).get("/api/nutrition/targets").set(bearer(a.token))).body.target;
    expect(t3).toMatchObject({ method: "MANUAL", calories: 1800 });
  });
});
