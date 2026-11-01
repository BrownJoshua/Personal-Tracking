import { describe, expect, it } from "vitest";
import {
  ROLES,
  PERMISSIONS,
  hasPermission,
  scaleNutrition,
  caloriesFromMacros,
  ageOn,
  createFoodSchema,
  createExerciseSchema,
  updateExerciseSchema,
  registerSchema,
  createMeasurementSchema,
  profileSchema,
} from "../src";

const chicken = {
  calories: 165,
  protein: 31,
  carbohydrates: 0,
  fat: 3.6,
  fibre: 0,
  sugar: null,
  saturatedFat: 1,
  sodiumMg: 74,
};

describe("permissions", () => {
  it("users cannot manage master data", () => {
    expect(hasPermission(ROLES.USER, PERMISSIONS.EXERCISES_MANAGE)).toBe(false);
    expect(hasPermission(ROLES.USER, PERMISSIONS.CATALOGUE_READ)).toBe(true);
  });
  it("admins can manage master data", () => {
    expect(hasPermission(ROLES.ADMIN, PERMISSIONS.EXERCISES_MANAGE)).toBe(true);
    expect(hasPermission(ROLES.ADMIN, PERMISSIONS.FOODS_MANAGE)).toBe(true);
  });
  it("trainer role is defined but has no admin permissions", () => {
    expect(hasPermission(ROLES.TRAINER, PERMISSIONS.ASSIGNED_USERS_READ)).toBe(true);
    expect(hasPermission(ROLES.TRAINER, PERMISSIONS.USERS_MANAGE)).toBe(false);
  });
});

describe("scaleNutrition", () => {
  it("scales 150 g of chicken breast from a 100 g basis", () => {
    const n = scaleNutrition(chicken, 100, 150);
    expect(n.calories).toBe(247.5);
    expect(n.protein).toBe(46.5);
    expect(n.fat).toBe(5.4);
    expect(n.sugar).toBeNull();
    expect(n.sodiumMg).toBe(111);
  });
  it("rejects invalid inputs", () => {
    expect(() => scaleNutrition(chicken, 0, 100)).toThrow();
    expect(() => scaleNutrition(chicken, 100, -1)).toThrow();
    expect(() => scaleNutrition(chicken, 100, Number.NaN)).toThrow();
  });
  it("computes calories from macros", () => {
    expect(caloriesFromMacros({ protein: 10, carbohydrates: 10, fat: 10 })).toBe(170);
  });
});

describe("ageOn", () => {
  it("handles birthdays not yet reached this year", () => {
    expect(ageOn("1990-06-15", new Date("2026-06-14T12:00:00Z"))).toBe(35);
    expect(ageOn("1990-06-15", new Date("2026-06-15T12:00:00Z"))).toBe(36);
  });
});

describe("validation", () => {
  const food = {
    name: "Chicken breast",
    kind: "GENERIC",
    category: "POULTRY",
    preparation: "COOKED",
    nutrition: chicken,
    source: "REFERENCE_DATA",
  } as const;

  it("accepts a valid generic food and applies defaults", () => {
    const r = createFoodSchema.parse(food);
    expect(r.servingBasis).toBe(100);
    expect(r.servingUnit).toBe("GRAM");
  });
  it("requires a brand for branded foods", () => {
    expect(createFoodSchema.safeParse({ ...food, kind: "BRANDED" }).success).toBe(false);
    expect(createFoodSchema.safeParse({ ...food, kind: "BRANDED", brand: "Acme" }).success).toBe(true);
  });
  it("rejects macros heavier than the serving", () => {
    const r = createFoodSchema.safeParse({ ...food, nutrition: { ...chicken, protein: 80, fat: 30 } });
    expect(r.success).toBe(false);
  });
  it("rejects unknown fields (no mass assignment)", () => {
    expect(createFoodSchema.safeParse({ ...food, status: "ARCHIVED" }).success).toBe(false);
  });

  const exercise = {
    code: "chest001",
    name: "Bench Press",
    primaryMuscleId: "64b000000000000000000001",
    exerciseType: "COMPOUND",
    movementPattern: "HORIZONTAL_PUSH",
    defaultSets: 3,
    defaultRepMin: 8,
    defaultRepMax: 10,
    defaultRestSeconds: 120,
  } as const;

  it("normalises exercise code to upper case", () => {
    expect(createExerciseSchema.parse(exercise).code).toBe("CHEST001");
  });
  it("rejects an inverted rep range on create and update", () => {
    expect(createExerciseSchema.safeParse({ ...exercise, defaultRepMin: 12 }).success).toBe(false);
    expect(updateExerciseSchema.safeParse({ defaultRepMin: 12, defaultRepMax: 8 }).success).toBe(false);
  });
  it("only accepts https media URLs", () => {
    expect(createExerciseSchema.safeParse({ ...exercise, mediaUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(createExerciseSchema.safeParse({ ...exercise, mediaUrl: "https://cdn.example.com/b.mp4" }).success).toBe(true);
  });

  it("enforces password strength and lower-cases email on register", () => {
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", password: "short" }).success).toBe(false);
    const r = registerSchema.parse({ name: "A", email: "  Ann@Example.COM ", password: "longenough123" });
    expect(r.email).toBe("ann@example.com");
    expect(r.clientType).toBe("mobile");
  });
  it("cannot self-assign a role at registration", () => {
    const r = registerSchema.parse({ name: "A", email: "a@b.co", password: "longenough123", role: "ADMIN" });
    expect(r).not.toHaveProperty("role");
  });

  it("requires at least one measurement value", () => {
    expect(createMeasurementSchema.safeParse({ measurements: {} }).success).toBe(false);
    expect(createMeasurementSchema.safeParse({ measurements: { weightKg: 74 } }).success).toBe(true);
  });
  it("rejects implausible dates of birth", () => {
    expect(profileSchema.safeParse({ dateOfBirth: "2025-01-01" }).success).toBe(false);
    expect(profileSchema.safeParse({ dateOfBirth: "1990-01-01" }).success).toBe(true);
  });
});

describe("friendly messages", () => {
  it("uses readable defaults and reports the first error per field", async () => {
    const { firstFieldErrors } = await import("../src");
    const r = createExerciseSchema.safeParse({ code: "X1", name: "N", primaryMuscleId: "", exerciseType: "" });
    expect(r.success).toBe(false);
    const errs = firstFieldErrors(r.error!);
    expect(errs.primaryMuscleId).toBe("Required");
    expect(errs.exerciseType).toBe("Required");
    expect(errs.defaultSets).toBe("Required");
    const bad = createExerciseSchema.safeParse({ exerciseType: "JUMPING" });
    expect(firstFieldErrors(bad.error!).exerciseType).toBe("Choose one of the options");
  });
});
