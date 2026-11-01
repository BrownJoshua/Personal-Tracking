import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { createApp } from "../../src/app";
import { hashPassword } from "../../src/modules/auth/auth.service";
import { EquipmentType, MuscleGroup } from "../../src/modules/exercises/lookup.models";
import { User } from "../../src/modules/users/user.model";

export const app = createApp();
export const PASSWORD = "correct-horse-42";

/** Connect to a fresh database per test file and wipe it between tests. */
export function useDatabase() {
  beforeAll(async () => {
    const base = inject("mongoUri");
    const dbName = `rt_test_${Math.random().toString(36).slice(2, 10)}`;
    await mongoose.connect(base, { dbName });
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  });
  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}

export async function registerUser(name: string, email: string, clientType: "mobile" | "web" = "mobile") {
  const res = await request(app).post("/api/auth/register").send({ name, email, password: PASSWORD, clientType });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken as string, refreshToken: res.body.refreshToken as string, id: res.body.user.id as string };
}

/** Admins cannot self-register; create one directly, then log in through the API. */
export async function createAdmin(email = "admin@example.com") {
  await User.create({ name: "Admin", email, passwordHash: await hashPassword(PASSWORD), role: "ADMIN", status: "ACTIVE" });
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  return { token: res.body.accessToken as string, id: res.body.user.id as string };
}

export async function seedLookups() {
  const [chest, triceps] = await MuscleGroup.create([
    { name: "Chest", slug: "chest" },
    { name: "Triceps", slug: "triceps" },
  ]);
  const barbell = await EquipmentType.create({ name: "Barbell", slug: "barbell" });
  return { chestId: String(chest!._id), tricepsId: String(triceps!._id), barbellId: String(barbell._id) };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
