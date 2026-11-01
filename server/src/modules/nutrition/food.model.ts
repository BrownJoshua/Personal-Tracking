import { Schema, model, type Types } from "mongoose";
import {
  FOOD_CATEGORIES,
  FOOD_KINDS,
  FOOD_PREPARATIONS,
  FOOD_SOURCES,
  RECORD_STATUSES,
  SERVING_UNITS,
  type FoodCategory,
  type FoodKind,
  type FoodPreparation,
  type FoodSource,
  type RecordStatus,
  type ServingUnit,
} from "@recomptrack/shared";

export interface INutrition {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fibre: number;
  sugar: number | null;
  saturatedFat: number | null;
  sodiumMg: number | null;
}

export const nutritionSchema = new Schema<INutrition>(
  {
    calories: { type: Number, required: true, min: 0 },
    protein: { type: Number, required: true, min: 0 },
    carbohydrates: { type: Number, required: true, min: 0 },
    fat: { type: Number, required: true, min: 0 },
    fibre: { type: Number, default: 0, min: 0 },
    sugar: { type: Number, default: null, min: 0 },
    saturatedFat: { type: Number, default: null, min: 0 },
    sodiumMg: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

export interface IFood {
  _id: Types.ObjectId;
  name: string;
  kind: FoodKind;
  brand: string | null;
  barcode: string | null;
  category: FoodCategory;
  preparation: FoodPreparation;
  servingBasis: number;
  servingUnit: ServingUnit;
  servingSizes: { label: string; quantity: number }[];
  nutrition: INutrition;
  source: FoodSource;
  sourceReference: string | null;
  /** name|brand|preparation, lower-cased — used to block duplicates. */
  dedupeKey: string;
  status: RecordStatus;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFood>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    kind: { type: String, enum: FOOD_KINDS, required: true },
    brand: { type: String, default: null, trim: true },
    barcode: { type: String, default: null },
    category: { type: String, enum: FOOD_CATEGORIES, required: true },
    preparation: { type: String, enum: FOOD_PREPARATIONS, required: true },
    servingBasis: { type: Number, required: true, default: 100 },
    servingUnit: { type: String, enum: SERVING_UNITS, required: true, default: "GRAM" },
    servingSizes: [{ _id: false, label: { type: String, required: true }, quantity: { type: Number, required: true } }],
    nutrition: { type: nutritionSchema, required: true },
    source: { type: String, enum: FOOD_SOURCES, required: true },
    sourceReference: { type: String, default: null },
    dedupeKey: { type: String, required: true },
    status: { type: String, enum: RECORD_STATUSES, default: "ACTIVE" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
schema.index({ dedupeKey: 1 }, { unique: true });
schema.index({ barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: "string" } } });
schema.index({ status: 1, name: 1 });
schema.index({ category: 1, status: 1 });

export const Food = model<IFood>("Food", schema, "foods");
