import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { enumLabel, type ExerciseDTO } from "@recomptrack/shared";
import { Card, ErrorNote, Screen, styles } from "../../components/ui";
import { api } from "../../services/api";
import { colors } from "../../theme";

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ["exercise", id], queryFn: () => api<ExerciseDTO>(`/exercises/${id}`), enabled: !!id });
  const e = q.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: e?.name ?? "Exercise" }} />
      <ErrorNote error={q.error} />
      {q.isLoading && <ActivityIndicator color={colors.primary} />}
      {e && (
        <>
          {e.status === "ARCHIVED" && <Text style={styles.muted}>This exercise has been retired from the library.</Text>}
          <Card title="Overview">
            <Text style={styles.listTitle}>{e.primaryMuscle?.name ?? "—"}</Text>
            {e.secondaryMuscles.length > 0 && <Text style={styles.muted}>Also works {e.secondaryMuscles.map((m) => m.name).join(", ")}</Text>}
            <Text style={styles.muted}>
              {[e.equipment?.name, enumLabel(e.exerciseType), enumLabel(e.movementPattern)].filter(Boolean).join(" · ")}
            </Text>
          </Card>
          <Card title="Default prescription">
            <Text style={styles.listTitle}>
              {e.defaultSets} sets × {e.defaultRepMin}–{e.defaultRepMax} reps · rest {e.defaultRestSeconds}s
            </Text>
          </Card>
          <Card title="How to">
            {e.instructions.length ? (
              e.instructions.map((step, i) => (
                <View key={i} style={[styles.row, { alignItems: "flex-start" }]}>
                  <Text style={[styles.listTitle, { width: 22 }]}>{i + 1}.</Text>
                  <Text style={[styles.listTitle, { flex: 1, fontWeight: "400" }]}>{step}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>No instructions yet.</Text>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
