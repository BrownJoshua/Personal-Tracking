/** Helper: build a const tuple + union type from a list of string literals. */
function values<const T extends readonly string[]>(v: T): T {
  return v;
}

export const USER_STATUSES = values(["ACTIVE", "DEACTIVATED"] as const);
export type UserStatus = (typeof USER_STATUSES)[number];

/** Lifecycle for admin-managed master data (exercises, foods, lookups). */
export const RECORD_STATUSES = values(["ACTIVE", "ARCHIVED"] as const);
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/** Lifecycle for versioned plans (Phase 2). */
export const PLAN_STATUSES = values(["DRAFT", "PUBLISHED", "ARCHIVED"] as const);
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const SEXES = values(["MALE", "FEMALE"] as const);
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = values([
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "ACTIVE",
  "VERY_ACTIVE",
] as const);
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const EXPERIENCE_LEVELS = values(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const);
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const GOAL_TYPES = values(["FAT_LOSS", "MUSCLE_GAIN", "RECOMPOSITION"] as const);
export type GoalType = (typeof GOAL_TYPES)[number];

export const UNIT_SYSTEMS = values(["METRIC", "IMPERIAL"] as const);
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

// ---- Exercises ----------------------------------------------------------
export const EXERCISE_TYPES = values(["COMPOUND", "ISOLATION", "CARDIO", "MOBILITY"] as const);
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const MOVEMENT_PATTERNS = values([
  "HORIZONTAL_PUSH",
  "HORIZONTAL_PULL",
  "VERTICAL_PUSH",
  "VERTICAL_PULL",
  "SQUAT",
  "HINGE",
  "LUNGE",
  "CARRY",
  "ROTATION",
  "ISOLATION",
  "CORE",
  "CARDIO",
  "OTHER",
] as const);
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const SET_TYPES = values(["WARM_UP", "WORKING", "DROP", "FAILURE"] as const);
export type SetType = (typeof SET_TYPES)[number];

// ---- Foods --------------------------------------------------------------
export const FOOD_KINDS = values(["GENERIC", "BRANDED"] as const);
export type FoodKind = (typeof FOOD_KINDS)[number];

export const FOOD_CATEGORIES = values([
  "MEAT",
  "POULTRY",
  "FISH_SEAFOOD",
  "EGGS",
  "DAIRY",
  "GRAINS",
  "LEGUMES",
  "VEGETABLES",
  "FRUITS",
  "NUTS_SEEDS",
  "OILS_FATS",
  "BEVERAGES",
  "SUPPLEMENTS",
  "SNACKS",
  "PREPARED_MEALS",
  "CONDIMENTS",
  "OTHER",
] as const);
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/** The state the nutrition values describe. Raw vs cooked changes values a lot. */
export const FOOD_PREPARATIONS = values(["RAW", "COOKED", "AS_PACKAGED"] as const);
export type FoodPreparation = (typeof FOOD_PREPARATIONS)[number];

export const SERVING_UNITS = values(["GRAM", "MILLILITRE"] as const);
export type ServingUnit = (typeof SERVING_UNITS)[number];

export const FOOD_SOURCES = values([
  "REFERENCE_DATA",
  "VERIFIED_LABEL",
  "ADMIN_ENTRY",
  "IMPORT",
] as const);
export type FoodSource = (typeof FOOD_SOURCES)[number];

export const MEAL_TYPES = values(["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const);
export type MealType = (typeof MEAL_TYPES)[number];

// ---- Measurements & activity --------------------------------------------
export const DATA_SOURCES = values(["MANUAL", "APPLE_HEALTH", "STRAVA", "IMPORT"] as const);
export type DataSource = (typeof DATA_SOURCES)[number];

export const MEASUREMENT_FIELDS = values([
  "weightKg",
  "bodyFatPercent",
  "waistCm",
  "chestCm",
  "shouldersCm",
  "neckCm",
  "leftArmCm",
  "rightArmCm",
  "hipsCm",
  "leftThighCm",
  "rightThighCm",
  "leftCalfCm",
  "rightCalfCm",
] as const);
export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number];

/** Human-readable label for any enum value: "HORIZONTAL_PUSH" -> "Horizontal push". */
export function enumLabel(value: string): string {
  const s = value.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
