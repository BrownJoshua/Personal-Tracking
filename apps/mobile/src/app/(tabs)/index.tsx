import { Text, View } from "react-native";
import { enumLabel } from "@recomptrack/shared";
import { Card, EmptyNote, Screen, styles } from "../../components/ui";
import { WeightEntry } from "../../components/WeightEntry";
import { useMeasurementSummary } from "../../hooks/useMeasurements";
import { useAuth } from "../../store/auth";
import { space } from "../../theme";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/**
 * Daily overview. Shows recorded data only — no estimated calories burned and no
 * assumed workouts. Cards for modules that arrive in later phases say so plainly.
 */
export default function DashboardScreen() {
  const { me } = useAuth();
  const summary = useMeasurementSummary();
  const s = summary.data;

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <Text style={styles.h1}>Hi {me?.user.name.split(" ")[0]}</Text>
        <Text style={styles.muted}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          {me?.goal ? ` · ${enumLabel(me.goal.goalType)}` : ""}
        </Text>
      </View>

      <Card title="Weight">
        {s?.latestWeight ? (
          <>
            <Text style={styles.bigNumber}>{s.latestWeight.valueKg} kg</Text>
            <Text style={styles.muted}>
              {fmtDate(s.latestWeight.recordedAt)}
              {s.weightSevenDayAverageKg !== null &&
                ` · 7-day average ${s.weightSevenDayAverageKg} kg (${s.weightEntriesLastSevenDays} entr${s.weightEntriesLastSevenDays === 1 ? "y" : "ies"})`}
            </Text>
          </>
        ) : (
          <EmptyNote>No weight logged yet.</EmptyNote>
        )}
        <WeightEntry />
      </Card>

      <Card title="Calories & macros">
        <EmptyNote>No food logged today. The food diary arrives with the next release; you can already browse foods in Nutrition.</EmptyNote>
      </Card>

      <Card title="Today's workout">
        <EmptyNote>No workout plan assigned yet. Your coach/admin will assign one; meanwhile browse the exercise library in Workout.</EmptyNote>
      </Card>

      <View style={{ flexDirection: "row", gap: space.md }}>
        <Card title="Activity" style={{ flex: 1 }}>
          <EmptyNote>Connect Apple Health or Strava (coming soon) to see steps and rides.</EmptyNote>
        </Card>
        <Card title="Recovery" style={{ flex: 1 }}>
          <EmptyNote>Sleep and resting heart rate appear here once permitted.</EmptyNote>
        </Card>
      </View>

      <Card title="Progress">
        {s?.latestWaist ? (
          <Text style={styles.listTitle}>
            Waist {s.latestWaist.valueCm} cm <Text style={styles.muted}>· {fmtDate(s.latestWaist.recordedAt)}</Text>
          </Text>
        ) : (
          <EmptyNote>No waist measurement yet.</EmptyNote>
        )}
      </Card>
    </Screen>
  );
}
