import type { CreateFoodInput } from "@recomptrack/shared";

export const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Lats",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Quadriceps",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Core",
];

export const EQUIPMENT = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Kettlebell", "Resistance band", "Smith machine"];

/** Starter exercises. Muscle and equipment are referenced by name and resolved at seed time. */
export const EXERCISES = [
  { code: "CHEST001", name: "Bench Press", primary: "Chest", secondary: ["Triceps", "Shoulders"], equipment: "Barbell", type: "COMPOUND", pattern: "HORIZONTAL_PUSH", sets: 3, repMin: 8, repMax: 10, rest: 120,
    instructions: ["Lie on the bench with eyes under the bar", "Grip slightly wider than shoulder width", "Lower the bar to mid-chest under control", "Press up until arms are straight"] },
  { code: "CHEST002", name: "Incline Dumbbell Press", primary: "Chest", secondary: ["Shoulders", "Triceps"], equipment: "Dumbbell", type: "COMPOUND", pattern: "HORIZONTAL_PUSH", sets: 3, repMin: 8, repMax: 12, rest: 90, instructions: [] },
  { code: "BACK001", name: "Lat Pulldown", primary: "Lats", secondary: ["Biceps"], equipment: "Cable", type: "COMPOUND", pattern: "VERTICAL_PULL", sets: 3, repMin: 10, repMax: 12, rest: 90, instructions: [] },
  { code: "BACK002", name: "Seated Cable Row", primary: "Back", secondary: ["Biceps", "Lats"], equipment: "Cable", type: "COMPOUND", pattern: "HORIZONTAL_PULL", sets: 3, repMin: 10, repMax: 12, rest: 90, instructions: [] },
  { code: "LEGS001", name: "Leg Press", primary: "Quadriceps", secondary: ["Glutes"], equipment: "Machine", type: "COMPOUND", pattern: "SQUAT", sets: 3, repMin: 8, repMax: 12, rest: 120, instructions: [] },
  { code: "LEGS002", name: "Romanian Deadlift", primary: "Hamstrings", secondary: ["Glutes", "Back"], equipment: "Barbell", type: "COMPOUND", pattern: "HINGE", sets: 3, repMin: 8, repMax: 10, rest: 120, instructions: [] },
  { code: "SHLD001", name: "Overhead Press", primary: "Shoulders", secondary: ["Triceps"], equipment: "Barbell", type: "COMPOUND", pattern: "VERTICAL_PUSH", sets: 3, repMin: 6, repMax: 10, rest: 120, instructions: [] },
  { code: "ARMS001", name: "Dumbbell Curl", primary: "Biceps", secondary: ["Forearms"], equipment: "Dumbbell", type: "ISOLATION", pattern: "ISOLATION", sets: 3, repMin: 10, repMax: 15, rest: 60, instructions: [] },
] as const;

/**
 * Starter foods: per 100 g, generic reference values. These are approximate
 * reference figures for development — verify against your chosen reference
 * database (e.g. USDA FoodData Central / IFCT) before production use.
 */
export const FOODS: CreateFoodInput[] = [
  { name: "Chicken breast", kind: "GENERIC", category: "POULTRY", preparation: "COOKED", source: "REFERENCE_DATA",
    nutrition: { calories: 165, protein: 31, carbohydrates: 0, fat: 3.6, fibre: 0 } },
  { name: "Chicken breast", kind: "GENERIC", category: "POULTRY", preparation: "RAW", source: "REFERENCE_DATA",
    nutrition: { calories: 120, protein: 22.5, carbohydrates: 0, fat: 2.6, fibre: 0 } },
  { name: "White rice", kind: "GENERIC", category: "GRAINS", preparation: "COOKED", source: "REFERENCE_DATA",
    nutrition: { calories: 130, protein: 2.7, carbohydrates: 28.2, fat: 0.3, fibre: 0.4 } },
  { name: "Whole egg", kind: "GENERIC", category: "EGGS", preparation: "RAW", source: "REFERENCE_DATA",
    servingSizes: [{ label: "1 large egg", quantity: 50 }],
    nutrition: { calories: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5, fibre: 0 } },
  { name: "Rolled oats", kind: "GENERIC", category: "GRAINS", preparation: "RAW", source: "REFERENCE_DATA",
    nutrition: { calories: 379, protein: 13.2, carbohydrates: 67.7, fat: 6.5, fibre: 10.1 } },
  { name: "Broccoli", kind: "GENERIC", category: "VEGETABLES", preparation: "RAW", source: "REFERENCE_DATA",
    nutrition: { calories: 34, protein: 2.8, carbohydrates: 6.6, fat: 0.4, fibre: 2.6 } },
  { name: "Banana", kind: "GENERIC", category: "FRUITS", preparation: "RAW", source: "REFERENCE_DATA",
    servingSizes: [{ label: "1 medium", quantity: 118 }],
    nutrition: { calories: 89, protein: 1.1, carbohydrates: 22.8, fat: 0.3, fibre: 2.6 } },
  { name: "Paneer", kind: "GENERIC", category: "DAIRY", preparation: "RAW", source: "REFERENCE_DATA",
    nutrition: { calories: 296, protein: 18.9, carbohydrates: 6.1, fat: 21.4, fibre: 0 } },
];
