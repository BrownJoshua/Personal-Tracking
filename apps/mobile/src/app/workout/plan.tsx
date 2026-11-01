import { Text, View } from "react-native";
import { WEEKDAY_NAMES, enumLabel } from "@recomptrack/shared";
import { Card, EmptyNote, ErrorNote, Row, Screen, styles } from "../../components/ui";
import { useCurrentPlan } from "../../hooks/useWorkouts";
import { space } from "../../theme";

export default function PlanScreen() {
  const q = useCurrentPlan();
  const d = q.data;
  return (
    <Screen>
      <ErrorNote error={q.error} />
      {q.isSuccess && !d && <EmptyNote>No plan assigned yet.</EmptyNote>}
      {d && (
        <>
          <Card>
            <Text style={styles.h2}>{d.plan.name}</Text>
            <Text style={styles.muted}>
              {enumLabel(d.plan.goalType)} · {enumLabel(d.plan.experienceLevel)} · {d.plan.daysPerWeek} days/week · {d.plan.durationWeeks} weeks
            </Text>
            <Text style={styles.muted}>Started {d.assignment.startDate.slice(0, 10)} · version {d.plan.version}</Text>
            {d.plan.description ? <Text style={styles.text}>{d.plan.description}</Text> : null}
          </Card>
          {d.plan.warmUpInstructions ? (
            <Card title="Warm-up">
              <Text style={styles.text}>{d.plan.warmUpInstructions}</Text>
            </Card>
          ) : null}
          {d.plan.days.map((day) => (
            <Card key={day.id} title={day.weekday ? WEEKDAY_NAMES[day.weekday - 1] : `Day ${day.dayNumber}`}>
              <Text style={styles.h2}>{day.dayName}</Text>
              {day.exercises.map((e) => (
                <View key={e.exerciseId + e.order} style={[styles.listItem, { gap: 2 }]}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Text style={[styles.listTitle, { flex: 1 }]}>{e.exerciseName}</Text>
                    <Text style={styles.text}>{e.sets} × {e.repMin}–{e.repMax}</Text>
                  </Row>
                  <Text style={styles.muted}>
                    {[e.primaryMuscle, e.equipment, `rest ${e.restSeconds}s`].filter(Boolean).join(" · ")}
                  </Text>
                  {e.notes ? <Text style={[styles.muted, { marginTop: space.xs }]}>{e.notes}</Text> : null}
                </View>
              ))}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
