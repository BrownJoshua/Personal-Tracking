/**
 * Idempotent seed: creates the first admin (from env) and starter master data.
 * Usage: SEED_ADMIN_PASSWORD=... npm run seed
 */
import { passwordSchema, emailSchema, foodDocumentSchema } from "@recomptrack/shared";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { hashPassword } from "../modules/auth/auth.service";
import { Exercise } from "../modules/exercises/exercise.model";
import { EquipmentType, MuscleGroup } from "../modules/exercises/lookup.models";
import { Food } from "../modules/nutrition/food.model";
import { User } from "../modules/users/user.model";
import { UserPreference } from "../modules/users/userPreference.model";
import { UserProfile } from "../modules/users/userProfile.model";
import { normalizedKey, slugify } from "../utils/text";
import { randomUUID } from "node:crypto";
import { scaleNutrition, sumNutrition } from "@recomptrack/shared";
import { MealTemplate } from "../modules/nutrition/nutrition.models";
import { toFoodDTO } from "../modules/nutrition/foods.service";
import { WorkoutPlan, WorkoutPlanDay } from "../modules/workouts/workout.models";
import { connectDatabase, disconnectDatabase } from "./connection";
import { EQUIPMENT, EXERCISES, FOODS, MUSCLE_GROUPS } from "./seedData";

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    logger.warn("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin account");
    return;
  }
  const parsedEmail = emailSchema.parse(email);
  passwordSchema.parse(password);
  const existing = await User.findOne({ email: parsedEmail });
  if (existing) {
    logger.info({ email: parsedEmail }, "Admin already exists");
    return;
  }
  const admin = await User.create({
    name: process.env.SEED_ADMIN_NAME ?? "Super Admin",
    email: parsedEmail,
    passwordHash: await hashPassword(password),
    role: "ADMIN",
    status: "ACTIVE",
    onboardingCompleted: true,
  });
  await Promise.all([UserProfile.create({ userId: admin._id }), UserPreference.create({ userId: admin._id })]);
  logger.info({ email: parsedEmail }, "Created admin account");
}

async function seedLookups() {
  for (const name of MUSCLE_GROUPS) {
    await MuscleGroup.updateOne({ slug: slugify(name) }, { $setOnInsert: { name, slug: slugify(name) } }, { upsert: true });
  }
  for (const name of EQUIPMENT) {
    await EquipmentType.updateOne({ slug: slugify(name) }, { $setOnInsert: { name, slug: slugify(name) } }, { upsert: true });
  }
}

async function seedExercises() {
  const muscles = new Map((await MuscleGroup.find().lean()).map((m) => [m.name, m._id]));
  const equipment = new Map((await EquipmentType.find().lean()).map((e) => [e.name, e._id]));
  for (const e of EXERCISES) {
    await Exercise.updateOne(
      { code: e.code },
      {
        $setOnInsert: {
          code: e.code,
          name: e.name,
          primaryMuscleId: muscles.get(e.primary),
          secondaryMuscleIds: e.secondary.map((s) => muscles.get(s)),
          equipmentId: equipment.get(e.equipment) ?? null,
          exerciseType: e.type,
          movementPattern: e.pattern,
          instructions: e.instructions,
          defaultSets: e.sets,
          defaultRepMin: e.repMin,
          defaultRepMax: e.repMax,
          defaultRestSeconds: e.rest,
          status: "ACTIVE",
        },
      },
      { upsert: true },
    );
  }
}

async function seedFoods() {
  for (const input of FOODS) {
    const f = foodDocumentSchema.parse(input);
    const dedupeKey = normalizedKey(f.name, f.brand, f.preparation);
    await Food.updateOne(
      { dedupeKey },
      { $setOnInsert: { ...f, brand: f.brand ?? null, barcode: null, sourceReference: null, dedupeKey, status: "ACTIVE" } },
      { upsert: true },
    );
  }
}

/** A published starter plan and meal template so assignment can be tried immediately. */
async function seedPlans() {
  const admin = await User.findOne({ role: "ADMIN" }).select({ _id: 1 }).lean();
  if (!admin) return;
  if (!(await WorkoutPlan.exists({ name: "Upper / Lower – 4 Days" }))) {
    const ex = new Map((await Exercise.find().lean()).map((e) => [e.code, e]));
    const pick = (code: string, sets: number, repMin: number, repMax: number, rest: number, order: number) => {
      const e = ex.get(code)!;
      return { exerciseId: e._id, exerciseNameSnapshot: e.name, order, sets, repMin, repMax, restSeconds: rest, notes: null };
    };
    const plan = await WorkoutPlan.create({
      planKey: randomUUID(), version: 1, isLatest: true, name: "Upper / Lower – 4 Days",
      description: "Four-day upper/lower split for recomposition.", goalType: "RECOMPOSITION", experienceLevel: "BEGINNER",
      durationWeeks: 8, daysPerWeek: 4, warmUpInstructions: "5 minutes easy cardio, then 2 light sets of the first exercise.",
      status: "PUBLISHED", publishedAt: new Date(), createdBy: admin._id,
    });
    await WorkoutPlanDay.insertMany([
      { workoutPlanId: plan._id, dayNumber: 1, weekday: 1, dayName: "Upper A", exercises: [pick("CHEST001", 3, 8, 10, 120, 1), pick("BACK001", 3, 10, 12, 90, 2), pick("BACK002", 3, 10, 12, 90, 3)] },
      { workoutPlanId: plan._id, dayNumber: 2, weekday: 2, dayName: "Lower A", exercises: [pick("LEGS001", 3, 8, 12, 120, 1), pick("LEGS002", 3, 8, 10, 120, 2)] },
      { workoutPlanId: plan._id, dayNumber: 3, weekday: 4, dayName: "Upper B", exercises: [pick("CHEST002", 3, 8, 12, 90, 1), pick("SHLD001", 3, 6, 10, 120, 2), pick("ARMS001", 3, 10, 15, 60, 3)] },
      { workoutPlanId: plan._id, dayNumber: 4, weekday: 6, dayName: "Lower B", exercises: [pick("LEGS002", 3, 8, 10, 120, 1), pick("LEGS001", 3, 10, 12, 90, 2)] },
    ]);
  }
  if (!(await MealTemplate.exists({ name: "Chicken and rice lunch" }))) {
    const foods = await Food.find({ dedupeKey: { $in: ["chicken breast||cooked", "white rice||cooked", "broccoli||raw"] } }).lean();
    const qty: Record<string, number> = { "chicken breast||cooked": 150, "white rice||cooked": 200, "broccoli||raw": 100 };
    const ingredients = foods.map((f) => ({ foodId: f._id, foodNameSnapshot: f.name, quantity: qty[f.dedupeKey]! }));
    const totalNutrition = sumNutrition(foods.map((f) => scaleNutrition(toFoodDTO(f).nutrition, f.servingBasis, qty[f.dedupeKey]!)));
    await MealTemplate.create({ name: "Chicken and rice lunch", mealType: "LUNCH", ingredients, totalNutrition, tags: ["high-protein"], status: "PUBLISHED", createdBy: admin._id });
  }
}

async function main() {
  await connectDatabase(env.MONGODB_URI);
  await seedAdmin();
  await seedLookups();
  await seedExercises();
  await seedFoods();
  await seedPlans();
  logger.info("Seed complete");
  await disconnectDatabase();
}

main().catch(async (err) => {
  logger.fatal({ err }, "Seed failed");
  await disconnectDatabase();
  process.exit(1);
});
