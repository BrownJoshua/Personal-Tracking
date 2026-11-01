import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import { formatDuration, type ExerciseLogDTO, type LoggedSetDTO, type WorkoutSessionDTO } from "@recomptrack/shared";
import { Backdrop, Button, Card, EmptyNote, ErrorNote, Row, Screen, styles } from "../../components/ui";
import { useActiveSession, useRefreshWorkouts } from "../../hooks/useWorkouts";
import { api } from "../../services/api";
import { colors, space } from "../../theme";

type SetInput = Omit<LoggedSetDTO, "setNumber">;

/** The number shown to the user: warm-ups are marked "W" and don't count. */
function displayNumber(log: ExerciseLogDTO, i: number) {
  return i + 1 - log.sets.slice(0, i).filter((s) => s.setType === "WARM_UP").length;
}
function setName(log: ExerciseLogDTO, i: number) {
  return log.sets[i]?.setType === "WARM_UP" ? `${log.exerciseName} warm-up set` : `${log.exerciseName} set ${displayNumber(log, i)}`;
}

/** Numeric input that keeps its own text while typing and commits a number on blur. */
function NumberInput({ value, onCommit, label, decimal }: { value: number | null; onCommit: (n: number | null) => void; label: string; decimal?: boolean }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === null ? "" : String(value));
  }, [value]);
  return (
    <TextInput
      accessibilityLabel={label}
      value={text}
      onChangeText={setText}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        const n = text.trim() === "" ? null : Number(text.replace(",", "."));
        onCommit(n === null || Number.isFinite(n) ? n : value);
      }}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      selectTextOnFocus
      placeholder="–"
      placeholderTextColor={colors.muted}
      style={[styles.input, { flex: 1, minWidth: 0, paddingVertical: 8, textAlign: "center" }]}
    />
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export default function ActiveWorkoutScreen() {
  const active = useActiveSession();
  const refreshAll = useRefreshWorkouts();
  const [session, setSession] = useState<WorkoutSessionDTO | null>(null);
  const [logs, setLogs] = useState<ExerciseLogDTO[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef<ExerciseLogDTO[]>([]);
  latest.current = logs;

  useFocusEffect(useCallback(() => void active.refetch(), [active.refetch]));
  useEffect(() => {
    if (active.data && active.data.id !== session?.id) {
      setSession(active.data);
      setLogs(active.data.exercises ?? []);
    } else if (active.data) {
      setSession(active.data);
      // Pick up exercises added from the library without discarding unsaved local edits.
      setLogs((cur) => (active.data!.exercises ?? []).map((l) => cur.find((c) => c.id === l.id) ?? l));
    }
  }, [active.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = useNow(true);
  const elapsed = session
    ? Math.max(0, Math.round(((session.pausedAt ? Date.parse(session.pausedAt) : now) - Date.parse(session.startedAt)) / 1000) - session.pausedSeconds)
    : 0;
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (rest && restLeft === 0) {
      setRest(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [rest, restLeft]);

  /** Save one exercise shortly after the last edit (and immediately on unmount via flush). */
  const persist = useCallback(
    (logId: string) => {
      const existing = timers.current.get(logId);
      if (existing) clearTimeout(existing);
      timers.current.set(
        logId,
        setTimeout(async () => {
          timers.current.delete(logId);
          const log = latest.current.find((l) => l.id === logId);
          if (!log || !session) return;
          try {
            await api(`/workouts/sessions/${session.id}/exercises/${logId}`, {
              method: "PUT",
              body: {
                sets: log.sets.map(({ setNumber: _n, ...s }) => s),
                notes: log.notes,
                discomfort: log.discomfort.reported ? log.discomfort : { reported: false, location: null, severity: null, notes: null },
              },
            });
            setError(null);
          } catch (e) {
            setError(e);
          }
        }, 700),
      );
    },
    [session],
  );

  async function flush() {
    const pending = [...timers.current.keys()];
    for (const id of pending) {
      clearTimeout(timers.current.get(id)!);
      timers.current.delete(id);
      const log = latest.current.find((l) => l.id === id);
      if (log && session) {
        await api(`/workouts/sessions/${session.id}/exercises/${id}`, {
          method: "PUT",
          body: { sets: log.sets.map(({ setNumber: _n, ...s }) => s), notes: log.notes, discomfort: log.discomfort.reported ? log.discomfort : { reported: false, location: null, severity: null, notes: null } },
        });
      }
    }
  }

  function updateLog(logId: string, patch: Partial<ExerciseLogDTO>) {
    setLogs((cur) => cur.map((l) => (l.id === logId ? { ...l, ...patch } : l)));
    persist(logId);
  }
  function updateSet(log: ExerciseLogDTO, index: number, patch: Partial<SetInput>) {
    updateLog(log.id, { sets: log.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  }
  function toggleDone(log: ExerciseLogDTO, index: number) {
    const set = log.sets[index]!;
    const completed = !set.completed;
    updateSet(log, index, { completed, reps: completed && set.reps === null ? (log.planned?.repMax ?? null) : set.reps });
    if (completed) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const secs = set.setType === "WARM_UP" ? 60 : (log.planned?.restSeconds ?? 90);
      if (secs > 0) setRest({ endsAt: Date.now() + secs * 1000, total: secs });
    }
  }
  function addSet(log: ExerciseLogDTO) {
    const last = log.sets[log.sets.length - 1];
    updateLog(log.id, {
      sets: [...log.sets, { setNumber: log.sets.length + 1, weightKg: last?.weightKg ?? null, reps: null, setType: "WORKING", completed: false, rpe: null }],
    });
  }

  async function lifecycle(action: "pause" | "resume") {
    if (!session) return;
    setBusy(true);
    try {
      setSession(await api<WorkoutSessionDTO>(`/workouts/sessions/${session.id}/${action}`, { method: "POST" }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function removeExercise(log: ExerciseLogDTO) {
    if (!session) return;
    Alert.alert("Remove exercise", `Remove ${log.exerciseName} from this workout?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const s = await api<WorkoutSessionDTO>(`/workouts/sessions/${session.id}/exercises/${log.id}`, { method: "DELETE" });
            setLogs((cur) => cur.filter((l) => l.id !== log.id));
            setSession(s);
          } catch (e) {
            setError(e);
          }
        },
      },
    ]);
  }

  function finish() {
    if (!session) return;
    Alert.alert("Finish workout?", "Your sets will be saved and the workout locked.", [
      { text: "Keep going", style: "cancel" },
      {
        text: "Finish",
        onPress: async () => {
          setBusy(true);
          try {
            await flush();
            const done = await api<WorkoutSessionDTO>(`/workouts/sessions/${session.id}/complete`, { method: "POST" });
            refreshAll();
            router.replace({ pathname: "/workout/[id]", params: { id: done.id } });
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function discard() {
    if (!session) return;
    Alert.alert("Discard workout?", "Nothing from this workout will be saved.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/workouts/sessions/${session.id}/discard`, { method: "POST" });
            refreshAll();
            router.back();
          } catch (e) {
            setError(e);
          }
        },
      },
    ]);
  }

  const doneSets = useMemo(() => logs.reduce((n, l) => n + l.sets.filter((s) => s.completed && s.setType !== "WARM_UP").length, 0), [logs]);

  if (active.isSuccess && !active.data) {
    return (
      <Screen>
        <EmptyNote>No workout in progress.</EmptyNote>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!session) return <View style={{ flex: 1 }}><Backdrop /></View>;
  const paused = session.status === "PAUSED";

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <View>
              <Text style={styles.h2}>{session.title}</Text>
              <Text style={styles.muted}>{doneSets} working sets done{paused ? " · paused" : ""}</Text>
            </View>
            <Text style={[styles.bigNumber, { fontSize: 26 }]} accessibilityLabel={`Elapsed ${formatDuration(elapsed)}`}>{formatDuration(elapsed)}</Text>
          </Row>
          <Row>
            <View style={{ flex: 1 }}><Button small variant="secondary" title={paused ? "Resume" : "Pause"} onPress={() => lifecycle(paused ? "resume" : "pause")} disabled={busy} /></View>
            <View style={{ flex: 1 }}><Button small title="Finish" onPress={finish} loading={busy} /></View>
          </Row>
        </Card>
        <ErrorNote error={error ?? active.error} />

        {logs.map((log) => (
          <Card
            key={log.id}
            title={log.planned ? `${log.planned.sets} × ${log.planned.repMin}–${log.planned.repMax} · rest ${log.planned.restSeconds}s` : "Added exercise"}
            right={<Pressable accessibilityLabel={`Remove ${log.exerciseName}`} onPress={() => removeExercise(log)}><Text style={{ color: colors.danger }}>Remove</Text></Pressable>}
          >
            <Text style={styles.h2}>{log.exerciseName}</Text>
            {log.previous?.length ? (
              <Text style={styles.muted}>Last time: {log.previous.map((p) => `${p.weightKg ?? 0}×${p.reps ?? 0}`).join(", ")}</Text>
            ) : null}
            <Row style={{ marginTop: space.xs }}>
              <Text style={[styles.muted, { width: 44 }]}>Set</Text>
              <Text style={[styles.muted, { flex: 1, textAlign: "center" }]}>kg</Text>
              <Text style={[styles.muted, { flex: 1, textAlign: "center" }]}>Reps</Text>
              <Text style={[styles.muted, { width: 48, textAlign: "center" }]}>Done</Text>
            </Row>
            {log.sets.map((set, i) => (
              <Row key={i} style={{ opacity: set.completed ? 0.75 : 1 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${setName(log, i)}. Tap to switch between warm-up and working set.`}
                  onPress={() => updateSet(log, i, { setType: set.setType === "WARM_UP" ? "WORKING" : "WARM_UP" })}
                  style={[styles.pill, { width: 44, paddingHorizontal: 0, alignItems: "center" }, set.setType === "WARM_UP" && { borderColor: colors.warning }]}
                >
                  <Text style={{ color: set.setType === "WARM_UP" ? colors.warning : colors.text, fontWeight: "700" }}>{set.setType === "WARM_UP" ? "W" : displayNumber(log, i)}</Text>
                </Pressable>
                <NumberInput label={`${setName(log, i)} weight in kilograms`} decimal value={set.weightKg} onCommit={(n) => updateSet(log, i, { weightKg: n })} />
                <NumberInput label={`${setName(log, i)} reps`} value={set.reps} onCommit={(n) => updateSet(log, i, { reps: n === null ? null : Math.round(n) })} />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: set.completed }}
                  accessibilityLabel={`Mark ${setName(log, i)} done`}
                  onPress={() => toggleDone(log, i)}
                  style={[styles.pill, { width: 48, paddingHorizontal: 0, alignItems: "center" }, set.completed && styles.pillOn]}
                >
                  <Text style={{ color: set.completed ? colors.primary : colors.muted, fontWeight: "800" }}>✓</Text>
                </Pressable>
              </Row>
            ))}
            <Row>
              <View style={{ flex: 1 }}><Button small variant="secondary" title="+ Set" onPress={() => addSet(log)} /></View>
              <View style={{ flex: 1 }}>
                <Button small variant="secondary" title="− Set" disabled={log.sets.length === 0} onPress={() => updateLog(log.id, { sets: log.sets.slice(0, -1) })} />
              </View>
            </Row>
            <TextInput
              placeholder="Notes"
              placeholderTextColor={colors.muted}
              value={log.notes ?? ""}
              onChangeText={(t) => updateLog(log.id, { notes: t || null })}
              style={[styles.input, { paddingVertical: 8 }]}
              accessibilityLabel={`${log.exerciseName} notes`}
            />
            <Row style={{ justifyContent: "space-between" }}>
              <Text style={styles.text}>Pain or discomfort</Text>
              <Switch
                value={log.discomfort.reported}
                onValueChange={(v) => updateLog(log.id, { discomfort: { ...log.discomfort, reported: v } })}
                trackColor={{ true: colors.danger, false: colors.border }}
                accessibilityLabel="Report pain or discomfort"
              />
            </Row>
            {log.discomfort.reported && (
              <Row>
                <TextInput
                  placeholder="Where? e.g. left shoulder"
                  placeholderTextColor={colors.muted}
                  value={log.discomfort.location ?? ""}
                  onChangeText={(t) => updateLog(log.id, { discomfort: { ...log.discomfort, location: t || null } })}
                  style={[styles.input, { flex: 2, minWidth: 0, paddingVertical: 8 }]}
                  accessibilityLabel="Discomfort location"
                />
                <View style={{ flex: 1 }}>
                  <NumberInput label="Severity 1 to 10" value={log.discomfort.severity} onCommit={(n) => updateLog(log.id, { discomfort: { ...log.discomfort, severity: n === null ? null : Math.min(10, Math.max(1, Math.round(n))) } })} />
                </View>
              </Row>
            )}
          </Card>
        ))}

        <Button title="+ Add exercise" variant="secondary" onPress={() => router.push({ pathname: "/exercises", params: { sessionId: session.id } })} />
        <Button title="Discard workout" variant="ghost" onPress={discard} />
        <View style={{ height: rest ? 90 : 0 }} />
      </Screen>

      {rest && (
        <View style={{ position: "absolute", left: space.lg, right: space.lg, bottom: space.xl }}>
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <View>
                <Text style={styles.muted}>Rest</Text>
                <Text style={[styles.bigNumber, { fontSize: 28 }]} accessibilityLiveRegion="polite">{formatDuration(restLeft)}</Text>
              </View>
              <Row>
                <Button small variant="secondary" title="+15s" onPress={() => setRest({ ...rest, endsAt: rest.endsAt + 15000 })} />
                <Button small title="Skip" onPress={() => setRest(null)} />
              </Row>
            </Row>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(restLeft / rest.total) * 100}%`, backgroundColor: colors.primary }]} />
            </View>
          </Card>
        </View>
      )}
    </View>
  );
}
