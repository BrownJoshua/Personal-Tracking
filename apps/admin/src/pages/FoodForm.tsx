import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  FOOD_CATEGORIES,
  FOOD_KINDS,
  FOOD_PREPARATIONS,
  FOOD_SOURCES,
  SERVING_UNITS,
  caloriesFromMacros,
  createFoodSchema,
  firstFieldErrors,
  type FoodCategory,
  type FoodDTO,
  type FoodKind,
  type FoodPreparation,
  type FoodSource,
  type ServingUnit,
} from "@recomptrack/shared";
import { EnumSelect, Field } from "../components/ui";
import { ApiError, api } from "../services/api";

const NUTRIENTS = [
  ["calories", "Calories (kcal)"],
  ["protein", "Protein (g)"],
  ["carbohydrates", "Carbohydrates (g)"],
  ["fat", "Fat (g)"],
  ["fibre", "Fibre (g)"],
  ["sugar", "Sugar (g)"],
  ["saturatedFat", "Saturated fat (g)"],
  ["sodiumMg", "Sodium (mg)"],
] as const;
type NutrientKey = (typeof NUTRIENTS)[number][0];
const OPTIONAL: NutrientKey[] = ["sugar", "saturatedFat", "sodiumMg"];

export function FoodForm({ food, onSaved, onCancel }: { food?: FoodDTO; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(food?.name ?? "");
  const [kind, setKind] = useState<FoodKind | "">(food?.kind ?? "GENERIC");
  const [brand, setBrand] = useState(food?.brand ?? "");
  const [barcode, setBarcode] = useState(food?.barcode ?? "");
  const [category, setCategory] = useState<FoodCategory | "">(food?.category ?? "");
  const [preparation, setPreparation] = useState<FoodPreparation | "">(food?.preparation ?? "");
  const [servingBasis, setServingBasis] = useState(String(food?.servingBasis ?? 100));
  const [servingUnit, setServingUnit] = useState<ServingUnit | "">(food?.servingUnit ?? "GRAM");
  const [source, setSource] = useState<FoodSource | "">(food?.source ?? "ADMIN_ENTRY");
  const [sourceReference, setSourceReference] = useState(food?.sourceReference ?? "");
  const [servingSizes, setServingSizes] = useState(food?.servingSizes ?? []);
  const [n, setN] = useState<Record<NutrientKey, string>>(() =>
    Object.fromEntries(NUTRIENTS.map(([k]) => [k, food?.nutrition[k] == null ? "" : String(food.nutrition[k])])) as Record<NutrientKey, string>,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (body: unknown) =>
      food ? api<FoodDTO>(`/admin/foods/${food.id}`, { method: "PATCH", body }) : api<FoodDTO>("/admin/foods", { method: "POST", body }),
    onSuccess: onSaved,
    onError: (err) => err instanceof ApiError && setErrors(err.fieldErrors()),
  });

  const num = (k: NutrientKey) => (n[k] === "" ? (OPTIONAL.includes(k) ? null : k === "fibre" ? 0 : NaN) : Number(n[k]));
  const implied = caloriesFromMacros({ protein: num("protein") || 0, carbohydrates: num("carbohydrates") || 0, fat: num("fat") || 0 });
  const entered = num("calories") ?? NaN;
  const mismatch = Number.isFinite(entered) && entered > 0 && Math.abs(implied - entered) / entered > 0.2;

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      name,
      kind,
      brand: kind === "BRANDED" ? brand : null,
      barcode: barcode.trim() || null,
      category,
      preparation,
      servingBasis: Number(servingBasis),
      servingUnit,
      servingSizes: servingSizes.filter((s) => s.label.trim() && s.quantity > 0),
      nutrition: Object.fromEntries(NUTRIENTS.map(([k]) => [k, num(k)])),
      source,
      sourceReference,
    };
    const parsed = createFoodSchema.safeParse(body);
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    save.mutate(body);
  }

  const unit = servingUnit === "MILLILITRE" ? "ml" : "g";

  return (
    <form className="form-grid" onSubmit={submit} noValidate>
      <Field label="Food name" error={errors.name} className="span-2">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Type" error={errors.kind}>
        <EnumSelect values={FOOD_KINDS} value={kind} onChange={setKind} />
      </Field>
      <Field label="Brand" error={errors.brand} hint={kind === "GENERIC" ? "Generic foods have no brand" : undefined}>
        <input value={brand} disabled={kind !== "BRANDED"} onChange={(e) => setBrand(e.target.value)} />
      </Field>
      <Field label="Category" error={errors.category}>
        <EnumSelect values={FOOD_CATEGORIES} value={category} onChange={setCategory} placeholder="Select…" />
      </Field>
      <Field label="Preparation" error={errors.preparation} hint="Which state the values describe — raw and cooked differ a lot">
        <EnumSelect values={FOOD_PREPARATIONS} value={preparation} onChange={setPreparation} placeholder="Select…" />
      </Field>
      <Field label="Nutrition per" error={errors.servingBasis}>
        <div className="input-group">
          <input type="number" min={1} value={servingBasis} onChange={(e) => setServingBasis(e.target.value)} />
          <EnumSelect values={SERVING_UNITS} value={servingUnit} onChange={setServingUnit} />
        </div>
      </Field>
      <Field label="Barcode" error={errors.barcode} hint="Optional, 8–14 digits">
        <input inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
      </Field>

      <fieldset className="span-2 nutrients">
        <legend>Nutrition per {servingBasis || "?"} {unit}</legend>
        {NUTRIENTS.map(([k, label]) => (
          <Field key={k} label={label} error={errors[`nutrition.${k}`]}>
            <input
              type="number"
              min={0}
              step="0.1"
              placeholder={OPTIONAL.includes(k) ? "optional" : ""}
              value={n[k]}
              onChange={(e) => setN((s) => ({ ...s, [k]: e.target.value }))}
            />
          </Field>
        ))}
        {errors.nutrition && <p className="error-text span-all">{errors.nutrition}</p>}
        {mismatch && (
          <p className="warning-text span-all">
            Macros imply about {implied} kcal, but {entered} kcal was entered. Double-check the label.
          </p>
        )}
      </fieldset>

      <Field label="Household servings" hint={`Optional shortcuts, e.g. "1 cup" = 240 ${unit}`} className="span-2">
        <div className="serving-sizes">
          {servingSizes.map((s, i) => (
            <div key={i} className="input-group">
              <input placeholder="Label" value={s.label} onChange={(e) => setServingSizes((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input type="number" min={0} placeholder={unit} value={s.quantity || ""} onChange={(e) => setServingSizes((l) => l.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))} />
              <button type="button" className="btn btn-sm" onClick={() => setServingSizes((l) => l.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setServingSizes((l) => [...l, { label: "", quantity: 0 }])}>Add serving</button>
        </div>
      </Field>

      <Field label="Data source" error={errors.source}>
        <EnumSelect values={FOOD_SOURCES} value={source} onChange={setSource} />
      </Field>
      <Field label="Source reference" error={errors.sourceReference} hint="Database id, label photo ref, URL…">
        <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
      </Field>

      {food && (
        <p className="muted small span-2">
          Corrections apply to future food logs only. Logged meals keep the nutrition values recorded at the time.
        </p>
      )}
      {save.error && !(save.error instanceof ApiError && save.error.details) && <p className="error-text span-2">{save.error.message}</p>}
      <div className="form-actions span-2">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : food ? "Save changes" : "Add food"}</button>
      </div>
    </form>
  );
}
