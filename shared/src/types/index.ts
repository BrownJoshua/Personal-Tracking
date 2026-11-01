import type {
  ActivityLevel,
  ExerciseType,
  ExperienceLevel,
  FoodCategory,
  FoodKind,
  FoodPreparation,
  FoodSource,
  GoalType,
  MovementPattern,
  RecordStatus,
  Role,
  ServingUnit,
  Sex,
  UnitSystem,
  UserStatus,
  DataSource,
} from "../constants";

/** All ids and dates cross the wire as strings. */
type Id = string;
type IsoDateTime = string;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---- Users --------------------------------------------------------------
export interface UserDTO {
  id: Id;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  onboardingCompleted: boolean;
  createdAt: IsoDateTime;
  lastLoginAt: IsoDateTime | null;
}

export interface ProfileDTO {
  dateOfBirth: string | null;
  heightCm: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  trainingExperience: ExperienceLevel | null;
  updatedAt: IsoDateTime | null;
}

export interface GoalDTO {
  id: Id;
  goalType: GoalType;
  targetWeightKg: number | null;
  targetBodyFatPercent: number | null;
  startDate: IsoDateTime;
  endDate: IsoDateTime | null;
  status: "ACTIVE" | "ENDED";
}

export interface PreferencesDTO {
  units: UnitSystem;
  timezone: string;
  notifications: { workoutReminders: boolean; weighInReminders: boolean; mealReminders: boolean };
  sharing: { shareProgressWithAdmin: boolean; shareNutritionWithAdmin: boolean };
}

export interface MeDTO {
  user: UserDTO;
  profile: ProfileDTO;
  goal: GoalDTO | null;
  preferences: PreferencesDTO;
  permissions: string[];
}

export interface AuthResponse {
  user: UserDTO;
  accessToken: string;
  accessTokenExpiresIn: number; // seconds
  /** Only returned to mobile clients; web clients get an httpOnly cookie. */
  refreshToken?: string;
}

// ---- Lookups ------------------------------------------------------------
export interface LookupDTO {
  id: Id;
  name: string;
  slug: string;
  description: string | null;
  status: RecordStatus;
}

// ---- Exercises ----------------------------------------------------------
export interface ExerciseDTO {
  id: Id;
  code: string;
  name: string;
  primaryMuscle: LookupDTO | null;
  secondaryMuscles: LookupDTO[];
  equipment: LookupDTO | null;
  exerciseType: ExerciseType;
  movementPattern: MovementPattern;
  instructions: string[];
  mediaUrl: string | null;
  defaultSets: number;
  defaultRepMin: number;
  defaultRepMax: number;
  defaultRestSeconds: number;
  notes: string | null;
  status: RecordStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ---- Foods --------------------------------------------------------------
export interface NutritionDTO {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fibre: number;
  sugar: number | null;
  saturatedFat: number | null;
  sodiumMg: number | null;
}

export interface FoodDTO {
  id: Id;
  name: string;
  kind: FoodKind;
  brand: string | null;
  barcode: string | null;
  category: FoodCategory;
  preparation: FoodPreparation;
  servingBasis: number;
  servingUnit: ServingUnit;
  servingSizes: { label: string; quantity: number }[];
  nutrition: NutritionDTO;
  source: FoodSource;
  sourceReference: string | null;
  status: RecordStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ---- Measurements -------------------------------------------------------
export interface BodyMeasurementDTO {
  id: Id;
  recordedAt: IsoDateTime;
  measurements: Partial<Record<string, number | null>>;
  source: DataSource;
  notes: string | null;
}

// ---- Admin --------------------------------------------------------------
export interface AdminDashboardDTO {
  range: { from: IsoDateTime; to: IsoDateTime };
  users: { total: number; active: number; deactivated: number; newInRange: number; activeInRange: number };
  catalogue: { exercises: number; archivedExercises: number; foods: number; archivedFoods: number };
  plans: { activeWorkoutPlans: number };
  activity: { workoutSessionsInRange: number; foodLogsInRange: number; measurementsInRange: number };
  latestRegistrations: Pick<UserDTO, "id" | "name" | "email" | "createdAt">[];
  latestAdminChanges: AuditLogDTO[];
}

export interface AuditLogDTO {
  id: Id;
  actor: { id: Id; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: Id | null;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: IsoDateTime;
}

export interface AdminUserDetailDTO {
  user: UserDTO;
  profile: Pick<ProfileDTO, "activityLevel" | "trainingExperience">;
  goal: Pick<GoalDTO, "goalType" | "startDate"> | null;
  sharing: PreferencesDTO["sharing"];
}

// ---- Workout plans (Phase 2) -------------------------------------------
export interface PlannedExerciseDTO {
  exerciseId: Id;
  exerciseName: string;
  primaryMuscle: string | null;
  equipment: string | null;
  order: number;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  notes: string | null;
}

export interface PlanDayDTO {
  id: Id;
  dayNumber: number;
  weekday: number | null;
  dayName: string;
  exercises: PlannedExerciseDTO[];
}

export interface WorkoutPlanSummaryDTO {
  id: Id;
  planKey: string;
  version: number;
  isLatest: boolean;
  name: string;
  description: string | null;
  goalType: GoalType;
  experienceLevel: ExperienceLevel;
  durationWeeks: number;
  daysPerWeek: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: IsoDateTime | null;
  activeAssignments?: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface WorkoutPlanDTO extends WorkoutPlanSummaryDTO {
  warmUpInstructions: string | null;
  days: PlanDayDTO[];
  versions: { id: Id; version: number; status: string; publishedAt: IsoDateTime | null }[];
}

export interface AssignmentDTO {
  id: Id;
  userId: Id;
  user?: { id: Id; name: string; email: string };
  workoutPlanId: Id;
  planName: string;
  planVersion: number;
  latestPublishedVersion: number | null;
  startDate: IsoDateTime;
  endDate: IsoDateTime | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdAt: IsoDateTime;
}

export interface CurrentPlanDTO {
  assignment: AssignmentDTO;
  plan: WorkoutPlanDTO;
}

export interface TodayWorkoutDTO {
  assignmentId: Id | null;
  /** The day to train today, or null on a scheduled rest day / no plan. */
  day: PlanDayDTO | null;
  reason: "NO_PLAN" | "NOT_STARTED" | "SCHEDULED" | "ROTATION" | "REST_DAY" | "DONE_TODAY";
  startsOn: string | null;
  activeSessionId: Id | null;
}

// ---- Workout sessions (Phase 3) ----------------------------------------
export interface LoggedSetDTO {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  setType: "WARM_UP" | "WORKING" | "DROP" | "FAILURE";
  completed: boolean;
  rpe: number | null;
}

export interface ExerciseLogDTO {
  id: Id;
  exerciseId: Id;
  exerciseName: string;
  order: number;
  planned: { sets: number; repMin: number; repMax: number; restSeconds: number } | null;
  previous: { weightKg: number | null; reps: number | null }[] | null;
  sets: LoggedSetDTO[];
  notes: string | null;
  discomfort: { reported: boolean; location: string | null; severity: number | null; notes: string | null };
}

export interface PersonalRecordDTO {
  exerciseId: Id;
  exerciseName: string;
  kind: "ESTIMATED_1RM" | "HEAVIEST_WEIGHT";
  value: number;
  previous: number | null;
}

export interface SessionSummaryDTO {
  durationSeconds: number;
  exercises: number;
  workingSets: number;
  reps: number;
  volumeKg: number;
  personalRecords: PersonalRecordDTO[];
}

export interface WorkoutSessionDTO {
  id: Id;
  title: string;
  workoutPlanId: Id | null;
  workoutPlanDayId: Id | null;
  startedAt: IsoDateTime;
  completedAt: IsoDateTime | null;
  pausedAt: IsoDateTime | null;
  pausedSeconds: number;
  status: "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "DISCARDED";
  notes: string | null;
  summary: SessionSummaryDTO | null;
  exercises?: ExerciseLogDTO[];
}

// ---- Nutrition diary (Phase 3) -----------------------------------------
export interface FoodLogDTO {
  id: Id;
  localDate: string;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  quantity: number;
  unit: "g" | "ml";
  food: { id: Id | null; customFoodId: Id | null; name: string; brand: string | null; preparation: string | null };
  mealTemplateId: Id | null;
  nutrition: NutritionDTO;
  loggedAt: IsoDateTime;
}

export interface NutritionTargetDTO {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fibre: number;
  method: "CALCULATED" | "MANUAL";
  effectiveFrom: IsoDateTime;
  note: string | null;
  breakdown: { bmr: number; maintenance: number; adjustmentPercent: number; age: number; weightKg: number; flooredToMinimum: boolean } | null;
}

export interface TargetStatusDTO {
  target: NutritionTargetDTO | null;
  /** Profile fields needed before targets can be calculated. */
  missing: string[];
  reviewDue: boolean;
}

export interface DiaryDayDTO {
  date: string;
  meals: Record<"BREAKFAST" | "LUNCH" | "DINNER" | "SNACK", { entries: FoodLogDTO[]; totals: NutritionDTO }>;
  totals: NutritionDTO;
  target: NutritionTargetDTO | null;
}

export interface NutritionHistoryDayDTO {
  date: string;
  entries: number;
  totals: NutritionDTO;
}

export interface CustomFoodDTO {
  id: Id;
  name: string;
  brand: string | null;
  servingBasis: number;
  servingUnit: ServingUnit;
  nutrition: NutritionDTO;
  createdAt: IsoDateTime;
}

export interface SavedMealDTO {
  id: Id;
  name: string;
  items: { foodId: Id | null; customFoodId: Id | null; name: string; quantity: number; unit: "g" | "ml"; nutrition: NutritionDTO; available: boolean }[];
  totals: NutritionDTO;
  createdAt: IsoDateTime;
}

export interface MealTemplateDTO {
  id: Id;
  name: string;
  description: string | null;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  tags: string[];
  ingredients: { foodId: Id; name: string; brand: string | null; preparation: string | null; quantity: number; unit: "g" | "ml"; nutrition: NutritionDTO; foodStatus: RecordStatus }[];
  totalNutrition: NutritionDTO;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  activeAssignments?: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface MealAssignmentDTO {
  id: Id;
  mealTemplate: MealTemplateDTO;
  startDate: IsoDateTime;
  endDate: IsoDateTime | null;
  status: "ACTIVE" | "ENDED";
}

export interface AdminUserPlansDTO {
  workoutAssignment: AssignmentDTO | null;
  workoutHistory: AssignmentDTO[];
  mealAssignments: { id: Id; mealTemplateId: Id; name: string; mealType: string; startDate: IsoDateTime; status: string }[];
  target: NutritionTargetDTO | null;
}
