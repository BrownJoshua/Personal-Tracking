import request from "supertest";
import { describe, expect, it } from "vitest";
import { Food } from "../../src/modules/nutrition/food.model";
import { FoodLog } from "../../src/modules/nutrition/nutrition.models";
import { ExerciseLog, WorkoutSession } from "../../src/modules/workouts/workout.models";
import { app, bearer, createAdmin, registerUser, seedLookups, useDatabase } from "./helpers";

useDatabase();

const benchPress = (chestId: string, tricepsId: string, barbellId: string) => ({
  code: "chest001",
  name: "Bench Press",
  primaryMuscleId: chestId,
  secondaryMuscleIds: [tricepsId],
  equipmentId: barbellId,
  exerciseType: "COMPOUND",
  movementPattern: "HORIZONTAL_PUSH",
  instructions: ["Lower to mid-chest", "Press up"],
  defaultSets: 3,
  defaultRepMin: 8,
  defaultRepMax: 10,
  defaultRestSeconds: 120,
});

const chicken = {
  name: "Chicken breast",
  kind: "GENERIC",
  category: "POULTRY",
  preparation: "COOKED",
  nutrition: { calories: 165, protein: 31, carbohydrates: 0, fat: 3.6, fibre: 0 },
  source: "REFERENCE_DATA",
};

describe("Phase 1 completion condition", () => {
  it("admin creates an exercise and a food; an authenticated user retrieves both", async () => {
    const admin = await createAdmin();
    const { chestId, tricepsId, barbellId } = await seedLookups();

    const ex = await request(app).post("/api/admin/exercises").set(bearer(admin.token)).send(benchPress(chestId, tricepsId, barbellId));
    expect(ex.status).toBe(201);
    expect(ex.body).toMatchObject({ code: "CHEST001", status: "ACTIVE", primaryMuscle: { name: "Chest" }, equipment: { name: "Barbell" } });

    const food = await request(app).post("/api/admin/foods").set(bearer(admin.token)).send(chicken);
    expect(food.status).toBe(201);

    const user = await registerUser("Ann", "ann@example.com");
    const exercises = await request(app).get("/api/exercises?q=bench").set(bearer(user.token));
    expect(exercises.status).toBe(200);
    expect(exercises.body.items.map((e: { name: string }) => e.name)).toEqual(["Bench Press"]);
    const foods = await request(app).get("/api/foods?q=chicken").set(bearer(user.token));
    expect(foods.body.items[0]).toMatchObject({ name: "Chicken breast", preparation: "COOKED", servingBasis: 100 });

    // Both changes are in the audit trail.
    const audit = await request(app).get("/api/admin/audit-logs").set(bearer(admin.token));
    expect(audit.body.items.map((a: { action: string }) => a.action)).toEqual(
      expect.arrayContaining(["EXERCISE_CREATED", "FOOD_CREATED"]),
    );
  });

  it("users cannot create master data", async () => {
    const { chestId, tricepsId, barbellId } = await seedLookups();
    const user = await registerUser("Ann", "ann@example.com");
    const res = await request(app).post("/api/admin/exercises").set(bearer(user.token)).send(benchPress(chestId, tricepsId, barbellId));
    expect(res.status).toBe(403);
  });
});

describe("exercise master rules", () => {
  it("rejects duplicate codes and unknown muscle groups", async () => {
    const admin = await createAdmin();
    const { chestId, tricepsId, barbellId } = await seedLookups();
    await request(app).post("/api/admin/exercises").set(bearer(admin.token)).send(benchPress(chestId, tricepsId, barbellId));
    const dup = await request(app).post("/api/admin/exercises").set(bearer(admin.token)).send(benchPress(chestId, tricepsId, barbellId));
    expect(dup.status).toBe(409);
    const bad = await request(app)
      .post("/api/admin/exercises")
      .set(bearer(admin.token))
      .send({ ...benchPress("64b000000000000000000009", tricepsId, barbellId), code: "X1" });
    expect(bad.status).toBe(400);
  });

  it("archived exercises disappear from the user library but history keeps the name", async () => {
    const admin = await createAdmin();
    const { chestId, tricepsId, barbellId } = await seedLookups();
    const ex = await request(app).post("/api/admin/exercises").set(bearer(admin.token)).send(benchPress(chestId, tricepsId, barbellId));
    const user = await registerUser("Ann", "ann@example.com");

    // User logged a workout with this exercise.
    const session = await WorkoutSession.create({ userId: user.id, startedAt: new Date(), status: "COMPLETED" });
    await ExerciseLog.create({
      workoutSessionId: session._id,
      userId: user.id,
      exerciseId: ex.body.id,
      exerciseNameSnapshot: "Bench Press",
      sets: [{ setNumber: 1, weightKg: 40, reps: 10, completed: true }],
    });

    // Referenced → cannot be deleted, must be archived.
    const del = await request(app).delete(`/api/admin/exercises/${ex.body.id}`).set(bearer(admin.token));
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe("EXERCISE_IN_USE");

    expect((await request(app).post(`/api/admin/exercises/${ex.body.id}/archive`).set(bearer(admin.token))).body.status).toBe("ARCHIVED");
    expect((await request(app).get("/api/exercises").set(bearer(user.token))).body.items).toHaveLength(0);
    // Still resolvable by id for history, and the snapshot is intact even after a rename.
    await request(app).patch(`/api/admin/exercises/${ex.body.id}`).set(bearer(admin.token)).send({ name: "Flat Bench Press" });
    expect((await request(app).get(`/api/exercises/${ex.body.id}`).set(bearer(user.token))).status).toBe(200);
    expect((await ExerciseLog.findOne({ exerciseId: ex.body.id }).lean())!.exerciseNameSnapshot).toBe("Bench Press");
  });

  it("unused exercises can be deleted", async () => {
    const admin = await createAdmin();
    const { chestId, tricepsId, barbellId } = await seedLookups();
    const ex = await request(app).post("/api/admin/exercises").set(bearer(admin.token)).send(benchPress(chestId, tricepsId, barbellId));
    expect((await request(app).delete(`/api/admin/exercises/${ex.body.id}`).set(bearer(admin.token))).status).toBe(204);
  });

  it("validates rep range against the stored document on partial update", async () => {
    const admin = await createAdmin();
    const { chestId, tricepsId, barbellId } = await seedLookups();
    const ex = await request(app).post("/api/admin/exercises").set(bearer(admin.token)).send(benchPress(chestId, tricepsId, barbellId));
    const res = await request(app).patch(`/api/admin/exercises/${ex.body.id}`).set(bearer(admin.token)).send({ defaultRepMin: 15 });
    expect(res.status).toBe(400);
  });
});

describe("food master rules", () => {
  it("blocks duplicates but allows the same food in a different preparation", async () => {
    const admin = await createAdmin();
    expect((await request(app).post("/api/admin/foods").set(bearer(admin.token)).send(chicken)).status).toBe(201);
    expect((await request(app).post("/api/admin/foods").set(bearer(admin.token)).send({ ...chicken, name: " chicken BREAST " })).status).toBe(409);
    const raw = { ...chicken, preparation: "RAW", nutrition: { ...chicken.nutrition, calories: 120 } };
    expect((await request(app).post("/api/admin/foods").set(bearer(admin.token)).send(raw)).status).toBe(201);
  });

  it("correcting nutrition does not change logged history; referenced foods can only be archived", async () => {
    const admin = await createAdmin();
    const user = await registerUser("Ann", "ann@example.com");
    const food = await request(app).post("/api/admin/foods").set(bearer(admin.token)).send(chicken);
    await FoodLog.create({
      userId: user.id,
      foodId: food.body.id,
      localDate: "2026-11-01",
      loggedAt: new Date(),
      mealType: "LUNCH",
      quantity: 150,
      foodSnapshot: { name: "Chicken breast", brand: null, preparation: "COOKED", servingBasis: 100, servingUnit: "GRAM" },
      nutritionSnapshot: { calories: 247.5, protein: 46.5, carbohydrates: 0, fat: 5.4, fibre: 0 },
    });

    const patch = await request(app)
      .patch(`/api/admin/foods/${food.body.id}`)
      .set(bearer(admin.token))
      .send({ nutrition: { ...chicken.nutrition, calories: 170 } });
    expect(patch.status).toBe(200);
    expect(patch.body.nutrition.calories).toBe(170);
    expect((await FoodLog.findOne().lean())!.nutritionSnapshot.calories).toBe(247.5);

    expect((await request(app).delete(`/api/admin/foods/${food.body.id}`).set(bearer(admin.token))).status).toBe(409);
    await request(app).post(`/api/admin/foods/${food.body.id}/archive`).set(bearer(admin.token));
    expect((await request(app).get("/api/foods").set(bearer(user.token))).body.items).toHaveLength(0);
    expect(await Food.countDocuments()).toBe(1);
  });

  it("re-checks cross-field rules on partial update", async () => {
    const admin = await createAdmin();
    const food = await request(app).post("/api/admin/foods").set(bearer(admin.token)).send(chicken);
    const res = await request(app).patch(`/api/admin/foods/${food.body.id}`).set(bearer(admin.token)).send({ kind: "BRANDED" });
    expect(res.status).toBe(400);
  });
});

describe("admin dashboard", () => {
  it("returns platform counts", async () => {
    const admin = await createAdmin();
    await registerUser("Ann", "ann@example.com");
    await registerUser("Ben", "ben@example.com");
    const res = await request(app).get("/api/admin/dashboard").set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.users).toMatchObject({ total: 2, active: 2, newInRange: 2 });
    expect(res.body.latestRegistrations).toHaveLength(2);
  });
});
