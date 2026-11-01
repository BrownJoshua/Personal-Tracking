import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { enumLabel, type ExerciseDTO, type LookupDTO, type Paginated, type WorkoutSessionDTO } from "@recomptrack/shared";
import { Backdrop, Card, EmptyNote, ErrorNote, styles } from "../components/ui";
import { useDebounced } from "../hooks/useDebounced";
import { api } from "../services/api";
import { colors, space } from "../theme";

/** Exercise library. With ?sessionId=… it becomes a picker that adds the exercise to that workout. */
export default function ExercisesScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [muscleId, setMuscleId] = useState<string | null>(null);
  const q = useDebounced(search);
  const muscles = useQuery({ queryKey: ["muscle-groups"], queryFn: () => api<LookupDTO[]>("/lookups/muscle-groups") });
  const list = useQuery({
    queryKey: ["exercises", q, muscleId],
    queryFn: () => api<Paginated<ExerciseDTO>>("/exercises", { query: { q, muscleId, limit: 100 } }),
  });
  const add = useMutation({
    mutationFn: (exerciseId: string) => api<WorkoutSessionDTO>(`/workouts/sessions/${sessionId}/exercises`, { method: "POST", body: { exerciseId } }),
    onSuccess: (s) => {
      qc.setQueryData(["workouts", "active"], s);
      router.back();
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <FlatList
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            {sessionId && <Text style={styles.muted}>Tap an exercise to add it to your workout.</Text>}
            <TextInput placeholder="Search exercises" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.input} accessibilityLabel="Search exercises" />
            <View style={styles.pills}>
              <Pressable onPress={() => setMuscleId(null)} style={[styles.pill, !muscleId && styles.pillOn]}>
                <Text style={[styles.pillText, !muscleId && styles.pillTextOn]}>All</Text>
              </Pressable>
              {muscles.data?.map((m) => (
                <Pressable key={m.id} onPress={() => setMuscleId(m.id === muscleId ? null : m.id)} style={[styles.pill, m.id === muscleId && styles.pillOn]}>
                  <Text style={[styles.pillText, m.id === muscleId && styles.pillTextOn]}>{m.name}</Text>
                </Pressable>
              ))}
            </View>
            <ErrorNote error={list.error ?? add.error} />
          </View>
        }
        data={list.data?.items ?? []}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => {
          const body = (
            <Card>
              <Text style={styles.listTitle}>{item.name}</Text>
              <Text style={styles.muted}>{[item.primaryMuscle?.name, item.equipment?.name, enumLabel(item.exerciseType)].filter(Boolean).join(" · ")}</Text>
            </Card>
          );
          return sessionId ? (
            <Pressable accessibilityRole="button" disabled={add.isPending} onPress={() => add.mutate(item.id)}>{body}</Pressable>
          ) : (
            <Link href={{ pathname: "/exercise/[id]", params: { id: item.id } }} asChild>
              <Pressable>{body}</Pressable>
            </Link>
          );
        }}
        ListEmptyComponent={list.isLoading ? undefined : <EmptyNote>No exercises found.</EmptyNote>}
      />
    </View>
  );
}
