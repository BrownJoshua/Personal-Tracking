import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { enumLabel } from "@recomptrack/shared";
import { MacroSummary } from "../../components/MacroSummary";
import { Button, Card, EmptyNote, Row, Screen, styles } from "../../components/ui";
import { WeightEntry } from "../../components/WeightEntry";
import { useMeasurementSummary } from "../../hooks/useMeasurements";
import { useDiary } from "../../hooks/useNutrition";
import { useToday } from "../../hooks/useWorkouts";
import { useAuth } from "../../store/auth";
import { colors, space } from "../../theme";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/**
 * Daily overview — recorded data only. No estimated calories burned, and a workout
 * only shows as done when the user actually completed it.
 */
export default function DashboardScreen() {
  const { me } = useAuth();
  const summary = useMeasurementSummary();
  const diary = useDiary();
  const today = useToday();
  const s = summary.data;
  const t = today.data;

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <Text style={styles.h1}>Hi {me?.user.name.split(" ")[0]}</Text>
        <Text style={styles.muted}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          {me?.goal ? ` · ${enumLabel(me.goal.goalType)}` : ""}
        </Text>
      </View>

      <Pressable onPress={() => router.push("/(tabs)/nutrition")} accessibilityRole="button" accessibilityLabel="Open nutrition diary">
        <Card title="Calories & macros">
          {diary.data ? <MacroSummary totals={diary.data.totals} target={diary.data.target} /> : <EmptyNote>Loading…</EmptyNote>}
          {diary.data && diary.data.totals.calories === 0 && <Text style={styles.muted}>Nothing logged today yet.</Text>}
        </Card>
      </Pressable>

      <Card title="Today's workout">
        {t?.activeSessionId ? (
          <>
            <Text style={styles.listTitle}>Workout in progress</Text>
            <Button title="Resume" onPress={() => router.push("/workout/active")} />
          </>
        ) : t?.day && t.reason !== "DONE_TODAY" ? (
          <>
            <Text style={styles.h2}>{t.day.dayName}</Text>
            <Text style={styles.muted}>{t.day.exercises.map((e) => e.exerciseName).join(" · ")}</Text>
            <Button title="Go to workout" variant="secondary" onPress={() => router.push("/(tabs)/workout")} />
          </>
        ) : (
          <EmptyNote>
            {t?.reason === "DONE_TODAY" ? `${t.day?.dayName ?? "Workout"} completed ✓` : t?.reason === "REST_DAY" ? "Rest day." : t?.reason === "NOT_STARTED" ? `Plan starts ${t.startsOn}.` : "No plan assigned yet."}
          </EmptyNote>
        )}
      </Card>

      <Card title="Weight">
        {s?.latestWeight ? (
          <>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
              <Text style={styles.bigNumber}>{s.latestWeight.valueKg} kg</Text>
              {s.weightSevenDayAverageKg !== null && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.statValue}>{s.weightSevenDayAverageKg} kg</Text>
                  <Text style={styles.muted}>7-day avg</Text>
                </View>
              )}
            </Row>
            <Text style={styles.muted}>{fmtDate(s.latestWeight.recordedAt)}</Text>
          </>
        ) : (
          <EmptyNote>No weight logged yet.</EmptyNote>
        )}
        <WeightEntry />
      </Card>

      <Row style={{ gap: space.md, alignItems: "stretch" }}>
        <Card title="Activity" style={{ flex: 1 }}>
          <EmptyNote>Apple Health & Strava sync is coming next.</EmptyNote>
        </Card>
        <Card title="Progress" style={{ flex: 1 }}>
          {s?.latestWaist ? (
            <Text style={styles.listTitle}>Waist {s.latestWaist.valueCm} cm</Text>
          ) : (
            <EmptyNote>No waist yet.</EmptyNote>
          )}
          <Link href="/progress/measurements" style={{ color: colors.primary }}>Measure →</Link>
        </Card>
      </Row>
    </Screen>
  );
}
