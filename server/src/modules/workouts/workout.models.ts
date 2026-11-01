/**
 * Workout collections. Phase 1 only defines the schemas (the API arrives in Phase 2/3),
 * because master-data rules already depend on them — e.g. an exercise referenced by a
 * plan or a logged set can be archived but never deleted.
 *
 * Versioning model:
 *   workoutPlans        one document per (planKey, version). Publishing a change creates a new version.
 *   workoutPlanDays     days + prescribed exercises of one specific plan version.
 *   userWorkoutAssignments  records the exact plan version a user follows.
 *   workoutSessions / exerciseLogs  what the user actually did, with name snapshots.
 */
import { Schema, model, type Types } from "mongoose";
import {
  EXPERIENCE_LEVELS,
  GOAL_TYPES,
  PLAN_STATUSES,
  SET_TYPES,
  type ExperienceLevel,
  type GoalType,
  type PlanStatus,
  type SetType,
} from "@recomptrack/shared";

// ---- workoutPlans -------------------------------------------------------
export interface IWorkoutPlan {
  _id: Types.ObjectId;
  planKey: string; // stable identity shared by all versions of the same plan
  version: number;
  name: string;
  description: string | null;
  goalType: GoalType;
  experienceLevel: ExperienceLevel;
  durationWeeks: number;
  daysPerWeek: number;
  warmUpInstructions: string | null;
  status: PlanStatus;
  publishedAt: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const workoutPlanSchema = new Schema<IWorkoutPlan>(
  {
    planKey: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: null },
    goalType: { type: String, enum: GOAL_TYPES, required: true },
    experienceLevel: { type: String, enum: EXPERIENCE_LEVELS, required: true },
    durationWeeks: { type: Number, required: true, min: 1, max: 52 },
    daysPerWeek: { type: Number, required: true, min: 1, max: 7 },
    warmUpInstructions: { type: String, default: null },
    status: { type: String, enum: PLAN_STATUSES, default: "DRAFT" },
    publishedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
workoutPlanSchema.index({ planKey: 1, version: 1 }, { unique: true });
workoutPlanSchema.index({ status: 1 });
export const WorkoutPlan = model<IWorkoutPlan>("WorkoutPlan", workoutPlanSchema, "workoutPlans");

// ---- workoutPlanDays ----------------------------------------------------
export interface IPlannedExercise {
  exerciseId: Types.ObjectId;
  exerciseNameSnapshot: string;
  order: number;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  notes: string | null;
}
export interface IWorkoutPlanDay {
  _id: Types.ObjectId;
  workoutPlanId: Types.ObjectId;
  dayNumber: number;
  weekday: number | null; // 1=Mon … 7=Sun, optional fixed scheduling
  dayName: string;
  exercises: IPlannedExercise[];
}
const plannedExerciseSchema = new Schema<IPlannedExercise>(
  {
    exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", required: true },
    exerciseNameSnapshot: { type: String, required: true },
    order: { type: Number, required: true },
    sets: { type: Number, required: true, min: 1 },
    repMin: { type: Number, required: true, min: 1 },
    repMax: { type: Number, required: true, min: 1 },
    restSeconds: { type: Number, required: true, min: 0 },
    notes: { type: String, default: null },
  },
  { _id: false },
);
const workoutPlanDaySchema = new Schema<IWorkoutPlanDay>({
  workoutPlanId: { type: Schema.Types.ObjectId, ref: "WorkoutPlan", required: true },
  dayNumber: { type: Number, required: true, min: 1 },
  weekday: { type: Number, default: null, min: 1, max: 7 },
  dayName: { type: String, required: true },
  exercises: [plannedExerciseSchema],
});
workoutPlanDaySchema.index({ workoutPlanId: 1, dayNumber: 1 }, { unique: true });
workoutPlanDaySchema.index({ "exercises.exerciseId": 1 });
export const WorkoutPlanDay = model<IWorkoutPlanDay>("WorkoutPlanDay", workoutPlanDaySchema, "workoutPlanDays");

// ---- userWorkoutAssignments --------------------------------------------
export interface IUserWorkoutAssignment {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  workoutPlanId: Types.ObjectId; // points at one specific version
  planVersion: number;
  startDate: Date;
  endDate: Date | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  assignedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const assignmentSchema = new Schema<IUserWorkoutAssignment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workoutPlanId: { type: Schema.Types.ObjectId, ref: "WorkoutPlan", required: true },
    planVersion: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: { type: String, enum: ["ACTIVE", "COMPLETED", "CANCELLED"], default: "ACTIVE" },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
assignmentSchema.index({ userId: 1, status: 1 });
assignmentSchema.index({ workoutPlanId: 1 });
export const UserWorkoutAssignment = model<IUserWorkoutAssignment>(
  "UserWorkoutAssignment",
  assignmentSchema,
  "userWorkoutAssignments",
);

// ---- workoutSessions ----------------------------------------------------
export interface IWorkoutSession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  assignmentId: Types.ObjectId | null;
  workoutPlanId: Types.ObjectId | null;
  workoutPlanDayId: Types.ObjectId | null;
  startedAt: Date;
  completedAt: Date | null;
  pausedSeconds: number;
  durationSeconds: number | null;
  status: "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "DISCARDED";
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
const workoutSessionSchema = new Schema<IWorkoutSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: "UserWorkoutAssignment", default: null },
    workoutPlanId: { type: Schema.Types.ObjectId, ref: "WorkoutPlan", default: null },
    workoutPlanDayId: { type: Schema.Types.ObjectId, ref: "WorkoutPlanDay", default: null },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    pausedSeconds: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: null },
    status: { type: String, enum: ["IN_PROGRESS", "PAUSED", "COMPLETED", "DISCARDED"], default: "IN_PROGRESS" },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);
workoutSessionSchema.index({ userId: 1, startedAt: -1 });
workoutSessionSchema.index({ status: 1, startedAt: -1 });
export const WorkoutSession = model<IWorkoutSession>("WorkoutSession", workoutSessionSchema, "workoutSessions");

// ---- exerciseLogs -------------------------------------------------------
export interface ILoggedSet {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  setType: SetType;
  completed: boolean;
  rpe: number | null;
}
export interface IExerciseLog {
  _id: Types.ObjectId;
  workoutSessionId: Types.ObjectId;
  userId: Types.ObjectId;
  exerciseId: Types.ObjectId;
  exerciseNameSnapshot: string;
  order: number;
  sets: ILoggedSet[];
  notes: string | null;
  discomfort: { reported: boolean; location: string | null; severity: number | null; notes: string | null };
  createdAt: Date;
  updatedAt: Date;
}
const loggedSetSchema = new Schema<ILoggedSet>(
  {
    setNumber: { type: Number, required: true },
    weightKg: { type: Number, default: null, min: 0 },
    reps: { type: Number, default: null, min: 0 },
    setType: { type: String, enum: SET_TYPES, default: "WORKING" },
    completed: { type: Boolean, default: false },
    rpe: { type: Number, default: null, min: 1, max: 10 },
  },
  { _id: false },
);
const exerciseLogSchema = new Schema<IExerciseLog>(
  {
    workoutSessionId: { type: Schema.Types.ObjectId, ref: "WorkoutSession", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", required: true },
    exerciseNameSnapshot: { type: String, required: true },
    order: { type: Number, default: 1 },
    sets: [loggedSetSchema],
    notes: { type: String, default: null },
    discomfort: {
      reported: { type: Boolean, default: false },
      location: { type: String, default: null },
      severity: { type: Number, default: null, min: 1, max: 10 },
      notes: { type: String, default: null },
    },
  },
  { timestamps: true },
);
exerciseLogSchema.index({ workoutSessionId: 1, order: 1 });
exerciseLogSchema.index({ userId: 1, exerciseId: 1, createdAt: -1 }); // strength progression
exerciseLogSchema.index({ exerciseId: 1 });
export const ExerciseLog = model<IExerciseLog>("ExerciseLog", exerciseLogSchema, "exerciseLogs");
