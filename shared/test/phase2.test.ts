import { describe, expect, it } from "vitest";
import {
  addDays,
  calculateTargets,
  estimateOneRepMax,
  localDateInZone,
  savePlanSchema,
  sumNutrition,
  summarizeSets,
  weekdayInZone,
  createFoodLogSchema,
  activeDurationSeconds,
} from "../src";

describe("calculateTargets (Mifflin-St Jeor)", () => {
  const base = {
    dateOfBirth: "1996-01-01",
    heightCm: 180,
    sex: "MALE" as const,
    activityLevel: "MODERATE" as const,
    weightKg: 80,
    goalType: "RECOMPOSITION" as const,
  };
  const today = new Date("2026-06-01T00:00:00Z"); // age 30

  it("computes calories and macros", () => {
    const r = calculateTargets(base, undefined, today);
    if (!r.ok) throw new Error("expected ok");
    expect(r.targets.breakdown.bmr).toBe(1780);
    expect(r.targets.breakdown.maintenance).toBe(2759);
    expect(r.targets.calories).toBe(2480);
    expect(r.targets.protein).toBe(160);
    expect(r.targets.fat).toBe(69);
    expect(r.targets.carbohydrates).toBe(305);
    expect(r.targets.fibre).toBe(35);
  });
  it("applies the minimum-calorie floor", () => {
    const r = calculateTargets({ ...base, sex: "FEMALE", weightKg: 40, heightCm: 145, activityLevel: "SEDENTARY", goalType: "FAT_LOSS" }, undefined, today);
    if (!r.ok) throw new Error("expected ok");
    expect(r.targets.calories).toBe(1200);
    expect(r.targets.breakdown.flooredToMinimum).toBe(true);
  });
  it("reports missing inputs instead of guessing", () => {
    const r = calculateTargets({ ...base, sex: null, weightKg: null });
    expect(r).toEqual({ ok: false, missing: ["sex", "weightKg"] });
  });
});

describe("workout maths", () => {
  it("Epley 1RM", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 10)).toBe(133.3);
    expect(estimateOneRepMax(0, 5)).toBe(0);
  });
  it("summarises only completed non-warm-up sets", () => {
    const s = summarizeSets([
      { weightKg: 20, reps: 10, setType: "WARM_UP", completed: true },
      { weightKg: 40, reps: 10, setType: "WORKING", completed: true },
      { weightKg: 40, reps: 9, setType: "WORKING", completed: true },
      { weightKg: 40, reps: 8, setType: "WORKING", completed: false },
    ]);
    expect(s).toMatchObject({ workingSets: 2, reps: 19, volumeKg: 760, heaviestKg: 40 });
  });
  it("excludes paused time", () => {
    expect(activeDurationSeconds(new Date(0), new Date(3_600_000), 600)).toBe(3000);
  });
});

describe("dates", () => {
  it("uses the user's time zone for the local day", () => {
    const instant = new Date("2026-11-01T20:30:00Z");
    expect(localDateInZone(instant, "UTC")).toBe("2026-11-01");
    expect(localDateInZone(instant, "Asia/Kolkata")).toBe("2026-11-02");
    expect(weekdayInZone(new Date("2026-11-02T10:00:00Z"), "UTC")).toBe(1); // Monday
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("nutrition totals", () => {
  it("adds up and keeps optional nutrients null when unknown", () => {
    const a = { calories: 100, protein: 10, carbohydrates: 5, fat: 2, fibre: 1, sugar: null, saturatedFat: null, sodiumMg: 50 };
    const t = sumNutrition([a, { ...a, sodiumMg: null }]);
    expect(t).toMatchObject({ calories: 200, protein: 20, sugar: null, sodiumMg: 50 });
  });
});

describe("plan & diary validation", () => {
  const ex = { exerciseId: "64b000000000000000000001", sets: 3, repMin: 8, repMax: 10, restSeconds: 120 };
  const plan = { name: "Upper / Lower", goalType: "RECOMPOSITION", experienceLevel: "BEGINNER", durationWeeks: 8 };
  it("requires all-or-none weekdays and no duplicates", () => {
    expect(savePlanSchema.safeParse({ ...plan, days: [{ dayName: "A", weekday: 1, exercises: [ex] }, { dayName: "B", exercises: [ex] }] }).success).toBe(false);
    expect(savePlanSchema.safeParse({ ...plan, days: [{ dayName: "A", weekday: 1, exercises: [ex] }, { dayName: "B", weekday: 1, exercises: [ex] }] }).success).toBe(false);
    expect(savePlanSchema.safeParse({ ...plan, days: [{ dayName: "A", weekday: 1, exercises: [ex] }, { dayName: "B", weekday: 4, exercises: [ex] }] }).success).toBe(true);
  });
  it("food log needs exactly one food reference", () => {
    expect(createFoodLogSchema.safeParse({ quantity: 100, mealType: "LUNCH" }).success).toBe(false);
    expect(createFoodLogSchema.safeParse({ foodId: "64b000000000000000000001", quantity: 100, mealType: "LUNCH" }).success).toBe(true);
  });
});
