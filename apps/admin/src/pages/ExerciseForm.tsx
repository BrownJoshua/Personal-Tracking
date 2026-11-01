import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  EXERCISE_TYPES,
  MOVEMENT_PATTERNS,
  createExerciseSchema,
  firstFieldErrors,
  type ExerciseDTO,
  type ExerciseType,
  type LookupDTO,
  type MovementPattern,
} from "@recomptrack/shared";
import { EnumSelect, Field } from "../components/ui";
import { ApiError, api } from "../services/api";

interface FormState {
  code: string;
  name: string;
  primaryMuscleId: string;
  secondaryMuscleIds: string[];
  equipmentId: string;
  exerciseType: ExerciseType | "";
  movementPattern: MovementPattern | "";
  instructions: string;
  mediaUrl: string;
  defaultSets: string;
  defaultRepMin: string;
  defaultRepMax: string;
  defaultRestSeconds: string;
  notes: string;
}

function initial(e?: ExerciseDTO): FormState {
  return {
    code: e?.code ?? "",
    name: e?.name ?? "",
    primaryMuscleId: e?.primaryMuscle?.id ?? "",
    secondaryMuscleIds: e?.secondaryMuscles.map((m) => m.id) ?? [],
    equipmentId: e?.equipment?.id ?? "",
    exerciseType: e?.exerciseType ?? "",
    movementPattern: e?.movementPattern ?? "",
    instructions: e?.instructions.join("\n") ?? "",
    mediaUrl: e?.mediaUrl ?? "",
    defaultSets: String(e?.defaultSets ?? 3),
    defaultRepMin: String(e?.defaultRepMin ?? 8),
    defaultRepMax: String(e?.defaultRepMax ?? 12),
    defaultRestSeconds: String(e?.defaultRestSeconds ?? 90),
    notes: e?.notes ?? "",
  };
}

export function ExerciseForm({ exercise, onSaved, onCancel }: { exercise?: ExerciseDTO; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState<FormState>(() => initial(exercise));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const muscles = useQuery({ queryKey: ["lookups", "muscle-groups"], queryFn: () => api<LookupDTO[]>("/lookups/muscle-groups") });
  const equipment = useQuery({ queryKey: ["lookups", "equipment"], queryFn: () => api<LookupDTO[]>("/lookups/equipment") });

  const save = useMutation({
    mutationFn: (body: unknown) =>
      exercise
        ? api<ExerciseDTO>(`/admin/exercises/${exercise.id}`, { method: "PATCH", body })
        : api<ExerciseDTO>("/admin/exercises", { method: "POST", body }),
    onSuccess: onSaved,
    onError: (err) => err instanceof ApiError && setErrors(err.fieldErrors()),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      code: f.code,
      name: f.name,
      primaryMuscleId: f.primaryMuscleId,
      secondaryMuscleIds: f.secondaryMuscleIds.filter((id) => id !== f.primaryMuscleId),
      equipmentId: f.equipmentId || null,
      exerciseType: f.exerciseType,
      movementPattern: f.movementPattern,
      instructions: f.instructions.split("\n").map((s) => s.trim()).filter(Boolean),
      mediaUrl: f.mediaUrl.trim() || null,
      defaultSets: Number(f.defaultSets),
      defaultRepMin: Number(f.defaultRepMin),
      defaultRepMax: Number(f.defaultRepMax),
      defaultRestSeconds: Number(f.defaultRestSeconds),
      notes: f.notes,
    };
    // Same schema the server uses — instant feedback, and the server re-validates anyway.
    const parsed = createExerciseSchema.safeParse(body);
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    save.mutate(body);
  }

  return (
    <form className="form-grid" onSubmit={submit} noValidate>
      <Field label="Exercise code" error={errors.code} hint="e.g. CHEST001">
        <input value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} />
      </Field>
      <Field label="Exercise name" error={errors.name}>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Primary muscle" error={errors.primaryMuscleId}>
        <select value={f.primaryMuscleId} onChange={(e) => set("primaryMuscleId", e.target.value)}>
          <option value="">Select…</option>
          {muscles.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Field>
      <Field label="Equipment" error={errors.equipmentId}>
        <select value={f.equipmentId} onChange={(e) => set("equipmentId", e.target.value)}>
          <option value="">None</option>
          {equipment.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Field>
      <Field label="Secondary muscles" error={errors.secondaryMuscleIds} className="span-2">
        <div className="chips">
          {muscles.data
            ?.filter((m) => m.id !== f.primaryMuscleId)
            .map((m) => {
              const on = f.secondaryMuscleIds.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  className={`chip ${on ? "chip-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => set("secondaryMuscleIds", on ? f.secondaryMuscleIds.filter((x) => x !== m.id) : [...f.secondaryMuscleIds, m.id])}
                >
                  {m.name}
                </button>
              );
            })}
        </div>
      </Field>
      <Field label="Exercise type" error={errors.exerciseType}>
        <EnumSelect values={EXERCISE_TYPES} value={f.exerciseType} onChange={(v) => set("exerciseType", v)} placeholder="Select…" />
      </Field>
      <Field label="Movement pattern" error={errors.movementPattern}>
        <EnumSelect values={MOVEMENT_PATTERNS} value={f.movementPattern} onChange={(v) => set("movementPattern", v)} placeholder="Select…" />
      </Field>
      <Field label="Default sets" error={errors.defaultSets}>
        <input type="number" min={1} max={10} value={f.defaultSets} onChange={(e) => set("defaultSets", e.target.value)} />
      </Field>
      <Field label="Default rest (seconds)" error={errors.defaultRestSeconds}>
        <input type="number" min={0} max={900} step={15} value={f.defaultRestSeconds} onChange={(e) => set("defaultRestSeconds", e.target.value)} />
      </Field>
      <Field label="Min reps" error={errors.defaultRepMin}>
        <input type="number" min={1} value={f.defaultRepMin} onChange={(e) => set("defaultRepMin", e.target.value)} />
      </Field>
      <Field label="Max reps" error={errors.defaultRepMax}>
        <input type="number" min={1} value={f.defaultRepMax} onChange={(e) => set("defaultRepMax", e.target.value)} />
      </Field>
      <Field label="Instructions" hint="One step per line" error={errors.instructions} className="span-2">
        <textarea rows={4} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} />
      </Field>
      <Field label="Demonstration URL" hint="https:// image or video link (uploads arrive with file storage)" error={errors.mediaUrl} className="span-2">
        <input type="url" value={f.mediaUrl} onChange={(e) => set("mediaUrl", e.target.value)} />
      </Field>
      <Field label="Admin notes" error={errors.notes} className="span-2">
        <textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      {exercise && (
        <p className="muted small span-2">
          Changing default sets/reps affects plans built from now on. Existing plans change only through a new plan
          version, and logged workouts are never altered.
        </p>
      )}
      {save.error && !(save.error instanceof ApiError && save.error.details) && <p className="error-text span-2">{save.error.message}</p>}
      <div className="form-actions span-2">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : exercise ? "Save changes" : "Add exercise"}</button>
      </div>
    </form>
  );
}
