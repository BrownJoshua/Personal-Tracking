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

async function main() {
  await connectDatabase(env.MONGODB_URI);
  await seedAdmin();
  await seedLookups();
  await seedExercises();
  await seedFoods();
  logger.info("Seed complete");
  await disconnectDatabase();
}

main().catch(async (err) => {
  logger.fatal({ err }, "Seed failed");
  await disconnectDatabase();
  process.exit(1);
});
