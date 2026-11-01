import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { formatDuration } from "@recomptrack/shared";
import { Card, ErrorNote, Row, Screen, Stat, styles } from "../../components/ui";
import { useSession } from "../../hooks/useWorkouts";
import { colors, space } from "../../theme";

export default function SessionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useSession(id);
  const s = q.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: s?.title ?? "Workout" }} />
      <ErrorNote error={q.error} />
      {q.isLoading && <ActivityIndicator color={colors.primary} />}
      {s && (
        <>
          <Text style={styles.muted}>
            {new Date(s.startedAt).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </Text>
          {s.summary && (
            <Card title="Summary">
              <Row style={{ gap: space.md }}>
                <Stat label="Duration" value={formatDuration(s.summary.durationSeconds)} />
                <Stat label="Volume" value={`${Math.round(s.summary.volumeKg)} kg`} />
              </Row>
              <Row style={{ gap: space.md }}>
                <Stat label="Working sets" value={String(s.summary.workingSets)} />
                <Stat label="Reps" value={String(s.summary.reps)} />
              </Row>
            </Card>
          )}
          {s.summary?.personalRecords.length ? (
            <Card title="Personal records 🏆">
              {s.summary.personalRecords.map((p, i) => (
                <View key={i} style={styles.listItem}>
                  <Text style={styles.listTitle}>{p.exerciseName}</Text>
                  <Text style={{ color: colors.success }}>
                    {p.kind === "HEAVIEST_WEIGHT" ? "Heaviest weight" : "Estimated 1RM"}: {p.value} kg{p.previous ? ` (was ${p.previous} kg)` : ""}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}
          {s.exercises?.map((e) => (
            <Card key={e.id} title={e.exerciseName}>
              {e.sets.map((set) => (
                <Row key={set.setNumber} style={{ justifyContent: "space-between", opacity: set.completed ? 1 : 0.45 }}>
                  <Text style={styles.muted}>{set.setType === "WARM_UP" ? "Warm-up" : `Set ${set.setNumber}`}</Text>
                  <Text style={styles.text}>
                    {set.weightKg ?? 0} kg × {set.reps ?? 0}
                    {set.completed ? "" : " (not done)"}
                  </Text>
                </Row>
              ))}
              {e.notes ? <Text style={styles.muted}>📝 {e.notes}</Text> : null}
              {e.discomfort.reported ? (
                <Text style={{ color: colors.danger }}>
                  Discomfort{e.discomfort.location ? ` — ${e.discomfort.location}` : ""}
                  {e.discomfort.severity ? ` (${e.discomfort.severity}/10)` : ""}
                </Text>
              ) : null}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
