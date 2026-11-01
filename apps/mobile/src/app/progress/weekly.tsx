import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { addDays, enumLabel } from "@recomptrack/shared";
import { BarChart } from "../../components/charts";
import { Card, EmptyNote, ErrorNote, Row, Screen, Stat, styles } from "../../components/ui";
import { useWeeklyReport } from "../../hooks/useReports";
import { colors } from "../../theme";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const TONE = { positive: colors.success, neutral: colors.muted, attention: colors.warning } as const;
const ICON = { positive: "✓", neutral: "•", attention: "!" } as const;

export default function WeeklyReportScreen() {
  const [week, setWeek] = useState<string | undefined>(undefined);
  const q = useWeeklyReport(week);
  const r = q.data;
  const [current, setCurrent] = useState<string | null>(null);
  if (r && !week && current !== r.weekStart) setCurrent(r.weekStart);

  return (
    <Screen>
      <Row style={{ justifyContent: "space-between" }}>
        <Pressable accessibilityLabel="Previous week" onPress={() => r && setWeek(addDays(r.weekStart, -7))} style={styles.pill}><Text style={styles.text}>‹</Text></Pressable>
        <Text style={styles.h2}>{r ? `${fmt(r.weekStart)} – ${fmt(r.weekEnd)}` : "…"}</Text>
        <Pressable
          accessibilityLabel="Next week"
          disabled={!r || r.weekStart === current}
          onPress={() => r && setWeek(addDays(r.weekStart, 7))}
          style={[styles.pill, (!r || r.weekStart === current) && { opacity: 0.3 }]}
        >
          <Text style={styles.text}>›</Text>
        </Pressable>
      </Row>
      <ErrorNote error={q.error} />
      {r && (
        <>
          <Card title="Highlights">
            {r.recommendations.length ? (
              r.recommendations.map((x, i) => (
                <Row key={i} style={{ alignItems: "flex-start" }}>
                  <Text style={{ color: TONE[x.tone], fontWeight: "800", width: 16 }} accessibilityLabel={x.tone}>{ICON[x.tone]}</Text>
                  <Text style={[styles.text, { flex: 1 }]}>{x.text}</Text>
                </Row>
              ))
            ) : (
              <EmptyNote>Nothing to report yet.</EmptyNote>
            )}
            <Text style={[styles.muted, { fontSize: 12 }]}>General guidance from your own logs — not medical advice.</Text>
          </Card>

          <Card title="Nutrition">
            <Row style={{ gap: 12 }}>
              <Stat label="Avg kcal" value={r.nutrition.avgCalories?.toString() ?? "—"} sub={r.nutrition.target ? `target ${r.nutrition.target.calories}` : undefined} />
              <Stat label="Avg protein" value={r.nutrition.avgProtein !== null ? `${r.nutrition.avgProtein} g` : "—"} sub={r.nutrition.target ? `target ${r.nutrition.target.protein} g` : undefined} />
              <Stat label="Days logged" value={`${r.nutrition.daysLogged}/7`} />
            </Row>
            {r.nutrition.daysLogged > 0 && (
              <BarChart
                unit="kcal"
                height={110}
                summary={`Calories per day: ${r.nutrition.days.map((d) => (d.entries ? Math.round(d.calories) : "not logged")).join(", ")}.`}
                formatLabel={(d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short" })}
                data={r.nutrition.days.map((d) => ({ label: d.date, value: d.calories }))}
              />
            )}
            <Text style={[styles.muted, { fontSize: 12 }]}>Averages use logged days only.</Text>
          </Card>

          <Card title="Training">
            <Row style={{ gap: 12 }}>
              <Stat label="Workouts" value={r.training.plannedPerWeek ? `${r.training.sessions}/${r.training.plannedPerWeek}` : String(r.training.sessions)} />
              <Stat label="Working sets" value={String(r.training.workingSets)} />
              <Stat label="Volume" value={`${Math.round(r.training.volumeKg).toLocaleString()} kg`} />
            </Row>
            {r.training.durationMinutes > 0 && <Text style={styles.muted}>Time training: {Math.floor(r.training.durationMinutes / 60) ? `${Math.floor(r.training.durationMinutes / 60)} h ` : ""}{r.training.durationMinutes % 60} min</Text>}
            {r.training.personalRecords.map((p, i) => (
              <Text key={i} style={{ color: colors.success }}>🏆 {p.exerciseName} — {p.kind === "HEAVIEST_WEIGHT" ? "heaviest" : "e1RM"} {p.value} kg</Text>
            ))}
          </Card>

          <Card title="Body">
            <Row style={{ gap: 12 }}>
              <Stat label="Avg weight" value={r.body.avgWeightKg !== null ? `${r.body.avgWeightKg} kg` : "—"} sub={`${r.body.weighIns} weigh-ins`} />
              <Stat
                label="vs last week"
                value={r.body.changeKg !== null ? `${r.body.changeKg > 0 ? "+" : ""}${r.body.changeKg} kg` : "—"}
              />
              <Stat label="Waist" value={r.body.latestWaistCm !== null ? `${r.body.latestWaistCm} cm` : "—"} sub={r.body.waistChangeCm !== null ? `${r.body.waistChangeCm > 0 ? "+" : ""}${r.body.waistChangeCm} cm` : undefined} />
            </Row>
            {r.goalType && <Text style={styles.muted}>Goal: {enumLabel(r.goalType)}</Text>}
          </Card>
          <View />
        </>
      )}
    </Screen>
  );
}
