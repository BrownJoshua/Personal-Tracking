import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type DragEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  EXPERIENCE_LEVELS,
  GOAL_TYPES,
  WEEKDAY_NAMES,
  enumLabel,
  firstFieldErrors,
  savePlanSchema,
  type ExerciseDTO,
  type ExperienceLevel,
  type GoalType,
  type Paginated,
  type UserDTO,
  type WorkoutPlanDTO,
} from "@recomptrack/shared";
import { ConfirmDialog, EnumSelect, ErrorBanner, Field, Modal, PageHeader, StatusBadge, formatDate } from "../components/ui";
import { UserPicker, todayIso } from "../components/UserPicker";
import { useDebounced } from "../hooks/useDebounced";
import { ApiError, api } from "../services/api";

interface ExRow { key: string; exerciseId: string; name: string; muscle: string | null; sets: number; repMin: number; repMax: number; restSeconds: number; notes: string }
interface DayRow { key: string; dayName: string; weekday: number | null; exercises: ExRow[] }
interface Draft { name: string; description: string; goalType: GoalType | ""; experienceLevel: ExperienceLevel | ""; durationWeeks: number; warmUpInstructions: string; days: DayRow[] }

let seq = 0;
const key = () => `k${++seq}`;

function fromPlan(p?: WorkoutPlanDTO): Draft {
  if (!p) return { name: "", description: "", goalType: "", experienceLevel: "", durationWeeks: 8, warmUpInstructions: "", days: [{ key: key(), dayName: "Day 1", weekday: null, exercises: [] }] };
  return {
    name: p.name,
    description: p.description ?? "",
    goalType: p.goalType,
    experienceLevel: p.experienceLevel,
    durationWeeks: p.durationWeeks,
    warmUpInstructions: p.warmUpInstructions ?? "",
    days: p.days.map((d) => ({
      key: key(),
      dayName: d.dayName,
      weekday: d.weekday,
      exercises: d.exercises.map((e) => ({ key: key(), exerciseId: e.exerciseId, name: e.exerciseName, muscle: e.primaryMuscle, sets: e.sets, repMin: e.repMin, repMax: e.repMax, restSeconds: e.restSeconds, notes: e.notes ?? "" })),
    })),
  };
}

function toBody(d: Draft) {
  return {
    name: d.name,
    description: d.description,
    goalType: d.goalType,
    experienceLevel: d.experienceLevel,
    durationWeeks: d.durationWeeks,
    warmUpInstructions: d.warmUpInstructions,
    days: d.days.map((day) => ({
      dayName: day.dayName,
      weekday: day.weekday,
      exercises: day.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets, repMin: e.repMin, repMax: e.repMax, restSeconds: e.restSeconds, notes: e.notes })),
    })),
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function PlanBuilderPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: ["admin-plan", id], queryFn: () => api<WorkoutPlanDTO>(`/admin/workout-plans/${id}`), enabled: !isNew });
  const [draft, setDraft] = useState<Draft>(() => fromPlan());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeDay, setActiveDay] = useState(0);
  const [confirm, setConfirm] = useState<null | "publish" | "archive" | "delete" | "revise">(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (plan.data) setDraft(fromPlan(plan.data));
  }, [plan.data]);

  const editable = isNew || plan.data?.status === "DRAFT";
  const weekdayMode = draft.days.some((d) => d.weekday !== null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-plans"] });
    void qc.invalidateQueries({ queryKey: ["admin-plan"] });
  };

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? api<WorkoutPlanDTO>("/admin/workout-plans", { method: "POST", body: toBody(draft) })
        : api<WorkoutPlanDTO>(`/admin/workout-plans/${id}`, { method: "PUT", body: toBody(draft) }),
    onSuccess: (p) => {
      invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (isNew) navigate(`/workouts/${p.id}`, { replace: true });
    },
    onError: (e) => e instanceof ApiError && setErrors(e.fieldErrors()),
  });

  const action = useMutation({
    mutationFn: async (kind: "publish" | "archive" | "delete" | "revise" | "duplicate") => {
      if (kind === "publish") {
        await api(`/admin/workout-plans/${id}`, { method: "PUT", body: toBody(draft) });
        return api<WorkoutPlanDTO>(`/admin/workout-plans/${id}/publish`, { method: "POST" });
      }
      if (kind === "delete") return api(`/admin/workout-plans/${id}`, { method: "DELETE" });
      return api<WorkoutPlanDTO>(`/admin/workout-plans/${id}/${kind}`, { method: "POST" });
    },
    onSuccess: (result, kind) => {
      setConfirm(null);
      invalidate();
      if (kind === "delete") navigate("/workouts");
      else if ((kind === "revise" || kind === "duplicate") && result) navigate(`/workouts/${(result as WorkoutPlanDTO).id}`);
    },
  });

  function validateAndSave() {
    const parsed = savePlanSchema.safeParse(toBody(draft));
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    save.mutate();
  }

  const setDay = (i: number, patch: Partial<DayRow>) => setDraft((d) => ({ ...d, days: d.days.map((day, j) => (j === i ? { ...day, ...patch } : day)) }));
  const setEx = (dayIdx: number, exIdx: number, patch: Partial<ExRow>) =>
    setDay(dayIdx, { exercises: draft.days[dayIdx]!.exercises.map((e, j) => (j === exIdx ? { ...e, ...patch } : e)) });

  function addExercise(e: ExerciseDTO) {
    const dayIdx = Math.min(activeDay, draft.days.length - 1);
    const day = draft.days[dayIdx]!;
    setDay(dayIdx, {
      exercises: [...day.exercises, { key: key(), exerciseId: e.id, name: e.name, muscle: e.primaryMuscle?.name ?? null, sets: e.defaultSets, repMin: e.defaultRepMin, repMax: e.defaultRepMax, restSeconds: e.defaultRestSeconds, notes: "" }],
    });
  }

  function toggleWeekdays(on: boolean) {
    setDraft((d) => ({ ...d, days: d.days.map((day, i) => ({ ...day, weekday: on ? Math.min(i + 1, 7) : null })) }));
  }

  // Drag to reorder within a day
  const [drag, setDrag] = useState<{ day: number; index: number } | null>(null);
  const [over, setOver] = useState<{ day: number; index: number } | null>(null);
  function onDrop(e: DragEvent, dayIdx: number, index: number) {
    e.preventDefault();
    if (drag && drag.day === dayIdx && drag.index !== index) setDay(dayIdx, { exercises: move(draft.days[dayIdx]!.exercises, drag.index, index) });
    setDrag(null);
    setOver(null);
  }

  const p = plan.data;
  const title = isNew ? "New workout plan" : p ? `${p.name}` : "Workout plan";

  return (
    <>
      <PageHeader
        title={title}
        subtitle={p ? `Version ${p.version} · ${enumLabel(p.status)}${p.publishedAt ? ` · published ${formatDate(p.publishedAt)}` : ""}` : "Draft — not visible to members until published and assigned"}
        actions={
          <>
            <Link className="btn" to="/workouts">Back</Link>
            {editable && <button className="btn" onClick={validateAndSave} disabled={save.isPending}>{save.isPending ? "Saving…" : saved ? "Saved ✓" : "Save draft"}</button>}
            {!isNew && p?.status === "DRAFT" && <button className="btn btn-primary" onClick={() => setConfirm("publish")}>Publish v{p.version}</button>}
            {p?.status === "PUBLISHED" && <button className="btn btn-primary" onClick={() => setAssignOpen(true)}>Assign to member</button>}
            {p && p.status !== "DRAFT" && p.isLatest && <button className="btn" onClick={() => setConfirm("revise")}>Edit as new version</button>}
            {p && <button className="btn" onClick={() => action.mutate("duplicate")}>Duplicate</button>}
            {p?.status === "PUBLISHED" && <button className="btn btn-danger-outline" onClick={() => setConfirm("archive")}>Archive</button>}
            {p?.status === "DRAFT" && <button className="btn btn-danger-outline" onClick={() => setConfirm("delete")}>Delete draft</button>}
          </>
        }
      />
      <ErrorBanner error={plan.error ?? save.error ?? action.error} />
      {p && !editable && (
        <div className="banner banner-info">
          This version is {p.status.toLowerCase()} and read-only. Members already following it keep it unchanged.
          {p.isLatest ? " Use “Edit as new version” to make changes." : " A newer version exists."}
        </div>
      )}

      <div className="builder">
        <div>
          <section className="card" style={{ marginBottom: 14 }}>
            <div className="form-grid">
              <Field label="Plan name" error={errors.name} className="span-2">
                <input value={draft.name} disabled={!editable} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Upper / Lower – 4 Days" />
              </Field>
              <Field label="Goal" error={errors.goalType}>
                <EnumSelect values={GOAL_TYPES} value={draft.goalType} disabled={!editable} onChange={(v) => setDraft({ ...draft, goalType: v })} placeholder="Select…" />
              </Field>
              <Field label="Experience" error={errors.experienceLevel}>
                <EnumSelect values={EXPERIENCE_LEVELS} value={draft.experienceLevel} disabled={!editable} onChange={(v) => setDraft({ ...draft, experienceLevel: v })} placeholder="Select…" />
              </Field>
              <Field label="Duration (weeks)" error={errors.durationWeeks}>
                <input type="number" min={1} max={52} value={draft.durationWeeks} disabled={!editable} onChange={(e) => setDraft({ ...draft, durationWeeks: Number(e.target.value) })} />
              </Field>
              <Field label="Scheduling" hint={weekdayMode ? "Each day is tied to a weekday" : "Members do the next day in order"}>
                <select value={weekdayMode ? "weekdays" : "rotation"} disabled={!editable} onChange={(e) => toggleWeekdays(e.target.value === "weekdays")}>
                  <option value="rotation">Rotation (next day in order)</option>
                  <option value="weekdays">Fixed weekdays</option>
                </select>
              </Field>
              <Field label="Description" className="span-2">
                <textarea rows={2} value={draft.description} disabled={!editable} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <Field label="Warm-up instructions" className="span-2">
                <textarea rows={2} value={draft.warmUpInstructions} disabled={!editable} onChange={(e) => setDraft({ ...draft, warmUpInstructions: e.target.value })} placeholder="5 minutes easy cardio, then 2 light sets…" />
              </Field>
            </div>
            {errors.days && <p className="error-text">{errors.days}</p>}
          </section>

          {draft.days.map((day, di) => (
            <section key={day.key} className={`builder-day ${activeDay === di && editable ? "drop-target-day" : ""}`} onClick={() => setActiveDay(di)} style={activeDay === di && editable ? { borderColor: "rgba(45,212,191,0.55)" } : undefined}>
              <div className="builder-day-head">
                <span className="badge badge-draft">Day {di + 1}</span>
                <input aria-label="Day name" value={day.dayName} disabled={!editable} onChange={(e) => setDay(di, { dayName: e.target.value })} />
                {weekdayMode && (
                  <select aria-label="Weekday" style={{ width: 140 }} value={day.weekday ?? 1} disabled={!editable} onChange={(e) => setDay(di, { weekday: Number(e.target.value) })}>
                    {WEEKDAY_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
                  </select>
                )}
                {editable && (
                  <>
                    <button className="icon-btn" aria-label="Move day up" disabled={di === 0} onClick={() => setDraft({ ...draft, days: move(draft.days, di, di - 1) })}>↑</button>
                    <button className="icon-btn" aria-label="Move day down" disabled={di === draft.days.length - 1} onClick={() => setDraft({ ...draft, days: move(draft.days, di, di + 1) })}>↓</button>
                    <button className="icon-btn" aria-label="Remove day" disabled={draft.days.length === 1} onClick={() => { setDraft({ ...draft, days: draft.days.filter((_, j) => j !== di) }); setActiveDay(0); }}>×</button>
                  </>
                )}
              </div>
              {errors[`days.${di}.dayName`] && <p className="error-text">{errors[`days.${di}.dayName`]}</p>}
              {day.exercises.length > 0 && (
                <div className="ex-row ex-head">
                  <span /> <span>Exercise</span> <span>Sets</span> <span>Min reps</span> <span>Max reps</span> <span>Rest (s)</span> <span />
                </div>
              )}
              {day.exercises.map((ex, ei) => (
                <div
                  key={ex.key}
                  className={`ex-row ${drag?.day === di && drag.index === ei ? "dragging" : ""} ${over?.day === di && over.index === ei ? "drop-target" : ""}`}
                  draggable={editable}
                  onDragStart={() => setDrag({ day: di, index: ei })}
                  onDragOver={(e) => { e.preventDefault(); setOver({ day: di, index: ei }); }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  onDrop={(e) => onDrop(e, di, ei)}
                >
                  <span className="drag-handle" title="Drag to reorder">{editable ? "⋮⋮" : ei + 1}</span>
                  <span className="ex-name">
                    {ex.name}
                    {ex.muscle && <span className="muted small"> · {ex.muscle}</span>}
                    {errors[`days.${di}.exercises.${ei}.repMax`] && <span className="error-text"> {errors[`days.${di}.exercises.${ei}.repMax`]}</span>}
                  </span>
                  <input aria-label="Sets" type="number" min={1} max={10} value={ex.sets} disabled={!editable} onChange={(e) => setEx(di, ei, { sets: Number(e.target.value) })} />
                  <input aria-label="Minimum reps" type="number" min={1} value={ex.repMin} disabled={!editable} onChange={(e) => setEx(di, ei, { repMin: Number(e.target.value) })} />
                  <input aria-label="Maximum reps" type="number" min={1} value={ex.repMax} disabled={!editable} onChange={(e) => setEx(di, ei, { repMax: Number(e.target.value) })} />
                  <input aria-label="Rest seconds" type="number" min={0} step={15} value={ex.restSeconds} disabled={!editable} onChange={(e) => setEx(di, ei, { restSeconds: Number(e.target.value) })} />
                  <span className="row-actions">
                    {editable && (
                      <>
                        <button className="icon-btn" aria-label="Move up" disabled={ei === 0} onClick={() => setDay(di, { exercises: move(day.exercises, ei, ei - 1) })}>↑</button>
                        <button className="icon-btn" aria-label="Move down" disabled={ei === day.exercises.length - 1} onClick={() => setDay(di, { exercises: move(day.exercises, ei, ei + 1) })}>↓</button>
                        <button className="icon-btn" aria-label="Remove exercise" onClick={() => setDay(di, { exercises: day.exercises.filter((_, j) => j !== ei) })}>×</button>
                      </>
                    )}
                  </span>
                </div>
              ))}
              {day.exercises.length === 0 && <p className="muted small">{editable ? "Select this day, then add exercises from the library →" : "No exercises."}</p>}
            </section>
          ))}
          {editable && draft.days.length < 7 && (
            <button className="btn" onClick={() => { setDraft({ ...draft, days: [...draft.days, { key: key(), dayName: `Day ${draft.days.length + 1}`, weekday: weekdayMode ? Math.min(draft.days.length + 1, 7) : null, exercises: [] }] }); setActiveDay(draft.days.length); }}>
              + Add training day
            </button>
          )}
        </div>

        <aside className="builder-side">
          {editable && <ExercisePicker targetDay={draft.days[activeDay]?.dayName ?? ""} onPick={addExercise} />}
          {p && p.versions.length > 0 && (
            <section className="card">
              <h3>Versions</h3>
              <ul className="list">
                {p.versions.map((v) => (
                  <li key={v.id}>
                    {v.id === p.id ? <strong>v{v.version} (this)</strong> : <Link to={`/workouts/${v.id}`}>v{v.version}</Link>}
                    <StatusBadge status={v.status} />
                  </li>
                ))}
              </ul>
              {p.activeAssignments !== undefined && <p className="muted small">{p.activeAssignments} member(s) on this version.</p>}
            </section>
          )}
          <section className="card">
            <h3>Mobile preview</h3>
            <MobilePreview draft={draft} />
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm === "publish" ? "Publish plan" : confirm === "archive" ? "Archive plan" : confirm === "revise" ? "Create new version" : "Delete draft"}
        message={
          confirm === "publish"
            ? "Publishing makes this version assignable and locks it. Any earlier published version is archived; members on it keep their version."
            : confirm === "archive"
              ? "Archived plans can't be assigned to new members. Members already following it are not affected."
              : confirm === "revise"
                ? "This creates an editable draft of the next version. The current version stays unchanged for members following it."
                : "Delete this draft permanently?"
        }
        confirmLabel={confirm === "revise" ? "Create draft" : confirm ? enumLabel(confirm) : ""}
        danger={confirm === "delete" || confirm === "archive"}
        busy={action.isPending}
        error={action.error?.message}
        onCancel={() => { setConfirm(null); action.reset(); }}
        onConfirm={() => confirm && action.mutate(confirm)}
      />
      {p && <AssignPlanModal open={assignOpen} plan={p} onClose={() => setAssignOpen(false)} onDone={invalidate} />}
    </>
  );
}

function ExercisePicker({ onPick, targetDay }: { onPick: (e: ExerciseDTO) => void; targetDay: string }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useQuery({
    queryKey: ["picker-exercises", dq],
    queryFn: () => api<Paginated<ExerciseDTO>>("/admin/exercises", { query: { q: dq, status: "ACTIVE", limit: 30 } }),
  });
  return (
    <section className="card">
      <h3>Exercise library</h3>
      <p className="muted small">Adding to: <strong>{targetDay}</strong></p>
      <input type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
      <div className="picker-results">
        {list.data?.items.map((e) => (
          <button type="button" key={e.id} className="picker-item" onClick={() => onPick(e)}>
            <span>{e.name}<br /><span className="muted small">{e.primaryMuscle?.name} · {e.equipment?.name ?? "No equipment"}</span></span>
            <span className="muted small">+ Add</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MobilePreview({ draft }: { draft: Draft }) {
  return (
    <div className="preview-phone" aria-label="Preview of how the plan appears in the app">
      <div className="preview-screen">
        <div className="preview-card">
          <small>Your plan</small>
          <div><strong>{draft.name || "Untitled plan"}</strong></div>
          <small>{draft.days.length} days · {draft.durationWeeks} weeks{draft.goalType ? ` · ${enumLabel(draft.goalType)}` : ""}</small>
        </div>
        {draft.days.map((d, i) => (
          <div key={d.key} className="preview-card">
            <small>{d.weekday ? WEEKDAY_NAMES[d.weekday - 1] : `Day ${i + 1}`}</small>
            <div><strong>{d.dayName}</strong></div>
            {d.exercises.map((e) => (
              <div key={e.key} className="small">{e.name} — {e.sets} × {e.repMin}–{e.repMax}</div>
            ))}
            {d.exercises.length === 0 && <small>No exercises yet</small>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssignPlanModal({ open, plan, onClose, onDone, user }: { open: boolean; plan?: WorkoutPlanDTO; user?: UserDTO; onClose: () => void; onDone: () => void }) {
  const [member, setMember] = useState<UserDTO | null>(user ?? null);
  const [planId, setPlanId] = useState(plan?.id ?? "");
  const [startDate, setStartDate] = useState(todayIso());
  const published = useQuery({
    queryKey: ["published-plans"],
    queryFn: () => api<Paginated<WorkoutPlanDTO>>("/admin/workout-plans", { query: { status: "PUBLISHED", latestOnly: "false", limit: 100 } }),
    enabled: open && !plan,
  });
  const assign = useMutation({
    mutationFn: () => api("/admin/assignments", { method: "POST", body: { userId: member!.id, workoutPlanId: planId, startDate } }),
    onSuccess: () => { onDone(); onClose(); },
  });
  return (
    <Modal
      title="Assign workout plan"
      open={open}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!member || !planId || assign.isPending} onClick={() => assign.mutate()}>{assign.isPending ? "Assigning…" : "Assign"}</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Member" className="span-2">
          {user ? <div><strong>{user.name}</strong> <span className="muted">{user.email}</span></div> : <UserPicker value={member} onChange={setMember} />}
        </Field>
        <Field label="Plan" className="span-2">
          {plan ? (
            <div><strong>{plan.name}</strong> <span className="muted">v{plan.version}</span></div>
          ) : (
            <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Select a published plan…</option>
              {published.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name} (v{p.version})</option>)}
            </select>
          )}
        </Field>
        <Field label="Start date">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <p className="muted small span-2">Any plan the member is currently following is ended and kept in their history.</p>
        {assign.error && <p className="error-text span-2">{assign.error.message}</p>}
      </div>
    </Modal>
  );
}
