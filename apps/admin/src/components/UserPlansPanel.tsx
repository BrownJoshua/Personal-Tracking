import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { enumLabel, manualTargetSchema, firstFieldErrors, type AdminUserPlansDTO, type UserDTO } from "@recomptrack/shared";
import { AssignMealModal } from "../pages/MealTemplatesPage";
import { AssignPlanModal } from "../pages/PlanBuilderPage";
import { api } from "../services/api";
import { ErrorBanner, Field, StatusBadge, formatDate } from "./ui";

/** Workout plan, meal plans and nutrition target for one member. */
export function UserPlansPanel({ user }: { user: UserDTO }) {
  const qc = useQueryClient();
  const key = ["admin-user-plans", user.id];
  const q = useQuery({ queryKey: key, queryFn: () => api<AdminUserPlansDTO>(`/admin/users/${user.id}/plans`) });
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const [assignPlan, setAssignPlan] = useState(false);
  const [assignMeal, setAssignMeal] = useState(false);
  const [editTarget, setEditTarget] = useState(false);
  const [t, setT] = useState({ calories: "", protein: "", carbohydrates: "", fat: "", fibre: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const endPlan = useMutation({ mutationFn: (id: string) => api(`/admin/assignments/${id}/end`, { method: "POST" }), onSuccess: refresh });
  const endMeal = useMutation({ mutationFn: (id: string) => api(`/admin/meal-assignments/${id}/end`, { method: "POST" }), onSuccess: refresh });
  const setTarget = useMutation({
    mutationFn: (body: unknown) => api<AdminUserPlansDTO>(`/admin/users/${user.id}/targets`, { method: "PUT", body }),
    onSuccess: (d) => { qc.setQueryData(key, d); setEditTarget(false); },
  });
  const recalc = useMutation({ mutationFn: () => api<AdminUserPlansDTO>(`/admin/users/${user.id}/targets/recalculate`, { method: "POST" }), onSuccess: (d) => qc.setQueryData(key, d) });

  const d = q.data;
  const target = d?.target;

  function openTargetEditor() {
    setT({
      calories: String(target?.calories ?? ""),
      protein: String(target?.protein ?? ""),
      carbohydrates: String(target?.carbohydrates ?? ""),
      fat: String(target?.fat ?? ""),
      fibre: String(target?.fibre ?? ""),
      note: "",
    });
    setEditTarget(true);
  }
  function saveTarget() {
    const body = { calories: Number(t.calories), protein: Number(t.protein), carbohydrates: Number(t.carbohydrates), fat: Number(t.fat), fibre: Number(t.fibre), note: t.note };
    const parsed = manualTargetSchema.safeParse(body);
    if (!parsed.success) return setErrors(firstFieldErrors(parsed.error));
    setErrors({});
    setTarget.mutate(body);
  }

  return (
    <div className="section">
      <ErrorBanner error={q.error ?? endPlan.error ?? endMeal.error ?? recalc.error} />
      <h3>Workout plan</h3>
      {d?.workoutAssignment ? (
        <div className="list">
          <li>
            <span>
              <strong>{d.workoutAssignment.planName}</strong> v{d.workoutAssignment.planVersion}
              <div className="muted small">From {formatDate(d.workoutAssignment.startDate).split(",")[0]}</div>
              {d.workoutAssignment.latestPublishedVersion && d.workoutAssignment.latestPublishedVersion > d.workoutAssignment.planVersion && (
                <div className="warning-text">Version {d.workoutAssignment.latestPublishedVersion} is available — reassign to move them to it.</div>
              )}
            </span>
            <button className="btn btn-sm" onClick={() => endPlan.mutate(d.workoutAssignment!.id)}>End</button>
          </li>
        </div>
      ) : (
        <p className="muted">No plan assigned.</p>
      )}
      <button className="btn btn-sm" onClick={() => setAssignPlan(true)}>{d?.workoutAssignment ? "Change plan" : "Assign plan"}</button>

      <h3 className="section">Meal plans</h3>
      {d?.mealAssignments.length ? (
        <ul className="list">
          {d.mealAssignments.map((m) => (
            <li key={m.id}>
              <span><strong>{m.name}</strong> <span className="muted small">{enumLabel(m.mealType)}</span></span>
              <button className="btn btn-sm" onClick={() => endMeal.mutate(m.id)}>End</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No meals assigned.</p>
      )}
      <button className="btn btn-sm" onClick={() => setAssignMeal(true)}>Assign meal</button>

      <h3 className="section">Daily nutrition target</h3>
      {target ? (
        <>
          <p>
            <strong>{target.calories} kcal</strong> · P {target.protein} g · C {target.carbohydrates} g · F {target.fat} g · Fibre {target.fibre} g{" "}
            <StatusBadge status={target.method} />
          </p>
          {target.note && <p className="muted small">{target.note}</p>}
        </>
      ) : (
        <p className="muted">No target yet — the member's profile is incomplete.</p>
      )}
      {!editTarget ? (
        <div className="input-group">
          <button className="btn btn-sm" onClick={openTargetEditor}>Set individual target</button>
          {target?.method === "MANUAL" && <button className="btn btn-sm" onClick={() => recalc.mutate()}>Reset to calculated</button>}
        </div>
      ) : (
        <div className="form-grid-3">
          {(["calories", "protein", "carbohydrates", "fat", "fibre"] as const).map((k) => (
            <Field key={k} label={k === "calories" ? "Calories" : `${enumLabel(k)} (g)`} error={errors[k]}>
              <input type="number" value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} />
            </Field>
          ))}
          <Field label="Note" className="span-all"><input value={t.note} onChange={(e) => setT({ ...t, note: e.target.value })} placeholder="Why this target" /></Field>
          {setTarget.error && <p className="error-text span-all">{setTarget.error.message}</p>}
          <div className="form-actions span-all">
            <button className="btn btn-sm" onClick={() => setEditTarget(false)}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={saveTarget} disabled={setTarget.isPending}>Save target</button>
          </div>
        </div>
      )}
      <p className="muted small">An individual target replaces the calculated one until reset. It never changes the member's logged food.</p>

      <AssignPlanModal open={assignPlan} user={user} onClose={() => setAssignPlan(false)} onDone={refresh} />
      {assignMeal && <AssignMealModal user={user} onClose={() => setAssignMeal(false)} onDone={refresh} />}
    </div>
  );
}
