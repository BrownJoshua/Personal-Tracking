import { Schema, model, type Types } from "mongoose";
import {
  EXERCISE_TYPES,
  MOVEMENT_PATTERNS,
  RECORD_STATUSES,
  type ExerciseType,
  type MovementPattern,
  type RecordStatus,
} from "@recomptrack/shared";

export interface IExercise {
  _id: Types.ObjectId;
  code: string;
  name: string;
  primaryMuscleId: Types.ObjectId;
  secondaryMuscleIds: Types.ObjectId[];
  equipmentId: Types.ObjectId | null;
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
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IExercise>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    primaryMuscleId: { type: Schema.Types.ObjectId, ref: "MuscleGroup", required: true },
    secondaryMuscleIds: [{ type: Schema.Types.ObjectId, ref: "MuscleGroup" }],
    equipmentId: { type: Schema.Types.ObjectId, ref: "EquipmentType", default: null },
    exerciseType: { type: String, enum: EXERCISE_TYPES, required: true },
    movementPattern: { type: String, enum: MOVEMENT_PATTERNS, required: true },
    instructions: [{ type: String, maxlength: 500 }],
    mediaUrl: { type: String, default: null },
    defaultSets: { type: Number, required: true, min: 1, max: 10 },
    defaultRepMin: { type: Number, required: true, min: 1 },
    defaultRepMax: { type: Number, required: true, min: 1 },
    defaultRestSeconds: { type: Number, required: true, min: 0 },
    notes: { type: String, default: null },
    status: { type: String, enum: RECORD_STATUSES, default: "ACTIVE" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
schema.index({ code: 1 }, { unique: true });
schema.index({ status: 1, name: 1 });
schema.index({ primaryMuscleId: 1, status: 1 });
schema.index({ equipmentId: 1, status: 1 });

export const Exercise = model<IExercise>("Exercise", schema, "exercises");
