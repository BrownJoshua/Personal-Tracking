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
