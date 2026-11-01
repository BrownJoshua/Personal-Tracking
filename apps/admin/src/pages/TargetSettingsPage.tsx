import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ACTIVITY_LEVELS, GOAL_TYPES, SEXES, enumLabel, firstFieldErrors, targetSettingsSchema, type TargetSettings } from "@recomptrack/shared";
import { ErrorBanner, Field, PageHeader } from "../components/ui";
import { api } from "../services/api";

export function TargetSettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["target-settings"], queryFn: () => api<TargetSettings>("/admin/target-settings") });
  const [s, setS] = useState<TargetSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  const save = useMutation({
    mutationFn: (body: TargetSettings) => api<TargetSettings>("/admin/target-settings", { method: "PUT", body }),
    onSuccess: (d) => { qc.setQueryData(["target-settings"], d); setSaved(true); setTimeout(() => setSaved(false), 2500); },
  });
  if (!s) return <><PageHeader title="Goals & Targets" /><ErrorBanner error={q.error} /></>;

  const num = (v: string) => (v === "" ? NaN : Number(v));
  const setGroup = <K extends "activityMultipliers" | "goalCalorieAdjustmentPercent" | "proteinGPerKg" | "minimumCalories">(k: K, sub: string, v: string) =>
    setS({ ...s, [k]: { ...s[k], [sub]: num(v) } });

  function submit() {
    const parsed = targetSettingsSchema.safeParse(s);
    if (!parsed.success) return setErrors(firstFieldErrors(parsed.error));
    setErrors({});
    save.mutate(parsed.data as TargetSettings);
  }

  return (
    <>
      <PageHeader
        title="Goals & Targets"
        subtitle="Defaults used to calculate each member's daily targets from their own profile"
        actions={<button className="btn btn-primary" onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : saved ? "Saved ✓" : "Save settings"}</button>}
      />
      <ErrorBanner error={save.error} />
      <div className="banner banner-info">
        Calories use the Mifflin-St Jeor equation × activity multiplier, adjusted for the goal. Exercise calories are never added on top,
        so training is not double-counted. Changes apply when a member's targets are next recalculated; individual overrides set on a
        member are kept.
      </div>
      <div className="two-col">
        <section className="card">
          <h2>Activity multipliers</h2>
          <div className="form-grid">
            {ACTIVITY_LEVELS.map((a) => (
              <Field key={a} label={enumLabel(a)} error={errors[`activityMultipliers.${a}`]}>
                <input type="number" step="0.025" value={s.activityMultipliers[a]} onChange={(e) => setGroup("activityMultipliers", a, e.target.value)} />
              </Field>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Per goal</h2>
          <table className="table table-compact">
            <thead><tr><th>Goal</th><th>Calorie change %</th><th>Protein g/kg</th></tr></thead>
            <tbody>
              {GOAL_TYPES.map((g) => (
                <tr key={g}>
                  <td>{enumLabel(g)}</td>
                  <td><input aria-label={`${g} calorie change`} type="number" value={s.goalCalorieAdjustmentPercent[g]} onChange={(e) => setGroup("goalCalorieAdjustmentPercent", g, e.target.value)} /></td>
                  <td><input aria-label={`${g} protein`} type="number" step="0.1" value={s.proteinGPerKg[g]} onChange={(e) => setGroup("proteinGPerKg", g, e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.entries(errors).filter(([k]) => k.startsWith("goal") || k.startsWith("protein")).map(([k, v]) => <p key={k} className="error-text">{k}: {v}</p>)}
        </section>
        <section className="card">
          <h2>Fat, fibre and floors</h2>
          <div className="form-grid">
            <Field label="Fat minimum (g/kg)" error={errors.fatMinGPerKg}><input type="number" step="0.1" value={s.fatMinGPerKg} onChange={(e) => setS({ ...s, fatMinGPerKg: num(e.target.value) })} /></Field>
            <Field label="Fat share of calories (%)" error={errors.fatPercentOfCalories}><input type="number" value={s.fatPercentOfCalories} onChange={(e) => setS({ ...s, fatPercentOfCalories: num(e.target.value) })} /></Field>
            <Field label="Fibre (g per 1000 kcal)" error={errors.fibreGPer1000Kcal}><input type="number" value={s.fibreGPer1000Kcal} onChange={(e) => setS({ ...s, fibreGPer1000Kcal: num(e.target.value) })} /></Field>
            <Field label="Review interval (weeks)" error={errors.reviewIntervalWeeks}><input type="number" value={s.reviewIntervalWeeks} onChange={(e) => setS({ ...s, reviewIntervalWeeks: num(e.target.value) })} /></Field>
            {SEXES.map((x) => (
              <Field key={x} label={`Minimum calories (${enumLabel(x).toLowerCase()})`} error={errors[`minimumCalories.${x}`]}>
                <input type="number" step="50" value={s.minimumCalories[x]} onChange={(e) => setGroup("minimumCalories", x, e.target.value)} />
              </Field>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
