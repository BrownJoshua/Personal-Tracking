/**
 * Nutrition collections beyond the food master. Schemas only in Phase 1;
 * the food-diary and meal-plan APIs arrive in Phase 2/3.
 */
import { Schema, model, type Types } from "mongoose";
import { MEAL_TYPES, PLAN_STATUSES, type MealType, type PlanStatus } from "@recomptrack/shared";
import { nutritionSchema, type INutrition } from "./food.model";

// ---- mealTemplates ------------------------------------------------------
export interface IMealIngredient {
  foodId: Types.ObjectId;
  foodNameSnapshot: string;
  quantity: number; // in the food's serving unit
}
export interface IMealTemplate {
  _id: Types.ObjectId;
  name: string;
  description: string | null;
  mealType: MealType;
  ingredients: IMealIngredient[];
  /** Derived from ingredients on save; never edited directly. */
  totalNutrition: INutrition;
  tags: string[];
  status: PlanStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const mealTemplateSchema = new Schema<IMealTemplate>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    mealType: { type: String, enum: MEAL_TYPES, required: true },
    ingredients: [
      {
        _id: false,
        foodId: { type: Schema.Types.ObjectId, ref: "Food", required: true },
        foodNameSnapshot: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0 },
      },
    ],
    totalNutrition: { type: nutritionSchema, required: true },
    tags: [String],
    status: { type: String, enum: PLAN_STATUSES, default: "DRAFT" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
mealTemplateSchema.index({ "ingredients.foodId": 1 });
export const MealTemplate = model<IMealTemplate>("MealTemplate", mealTemplateSchema, "mealTemplates");

// ---- userMealAssignments ------------------------------------------------
export interface IUserMealAssignment {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  mealTemplateId: Types.ObjectId;
  startDate: Date;
  endDate: Date | null;
  status: "ACTIVE" | "ENDED";
  assignedBy: Types.ObjectId;
}
const userMealAssignmentSchema = new Schema<IUserMealAssignment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mealTemplateId: { type: Schema.Types.ObjectId, ref: "MealTemplate", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: { type: String, enum: ["ACTIVE", "ENDED"], default: "ACTIVE" },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
userMealAssignmentSchema.index({ userId: 1, status: 1 });
export const UserMealAssignment = model<IUserMealAssignment>(
  "UserMealAssignment",
  userMealAssignmentSchema,
  "userMealAssignments",
);

// ---- customFoods (user-submitted, private to the user) -------------------
export interface ICustomFood {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  brand: string | null;
  servingBasis: number;
  servingUnit: "GRAM" | "MILLILITRE";
  nutrition: INutrition;
  createdAt: Date;
  updatedAt: Date;
}
const customFoodSchema = new Schema<ICustomFood>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: null },
    servingBasis: { type: Number, required: true, default: 100 },
    servingUnit: { type: String, enum: ["GRAM", "MILLILITRE"], default: "GRAM" },
    nutrition: { type: nutritionSchema, required: true },
  },
  { timestamps: true },
);
customFoodSchema.index({ userId: 1, name: 1 });
export const CustomFood = model<ICustomFood>("CustomFood", customFoodSchema, "customFoods");

// ---- foodLogs -----------------------------------------------------------
export interface IFoodLog {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** Exactly one of foodId / customFoodId is set. */
  foodId: Types.ObjectId | null;
  customFoodId: Types.ObjectId | null;
  mealTemplateId: Types.ObjectId | null;
  /** User's local calendar day (YYYY-MM-DD) in their timezone at logging time. */
  localDate: string;
  loggedAt: Date;
  mealType: MealType;
  quantity: number;
  /** Frozen copy so later corrections to the food master never change history. */
  foodSnapshot: { name: string; brand: string | null; preparation: string | null; servingBasis: number; servingUnit: string };
  nutritionSnapshot: INutrition; // for the eaten quantity
  createdAt: Date;
  updatedAt: Date;
}
const foodLogSchema = new Schema<IFoodLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    foodId: { type: Schema.Types.ObjectId, ref: "Food", default: null },
    customFoodId: { type: Schema.Types.ObjectId, ref: "CustomFood", default: null },
    mealTemplateId: { type: Schema.Types.ObjectId, ref: "MealTemplate", default: null },
    localDate: { type: String, required: true },
    loggedAt: { type: Date, required: true },
    mealType: { type: String, enum: MEAL_TYPES, required: true },
    quantity: { type: Number, required: true, min: 0 },
    foodSnapshot: {
      name: { type: String, required: true },
      brand: { type: String, default: null },
      preparation: { type: String, default: null },
      servingBasis: { type: Number, required: true },
      servingUnit: { type: String, required: true },
    },
    nutritionSnapshot: { type: nutritionSchema, required: true },
  },
  { timestamps: true },
);
foodLogSchema.index({ userId: 1, localDate: -1 });
foodLogSchema.index({ foodId: 1 });
foodLogSchema.index({ createdAt: -1 });
export const FoodLog = model<IFoodLog>("FoodLog", foodLogSchema, "foodLogs");
