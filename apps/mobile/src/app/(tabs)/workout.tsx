import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { enumLabel, type ExerciseDTO, type LookupDTO, type Paginated } from "@recomptrack/shared";
import { Card, EmptyNote, ErrorNote, styles } from "../../components/ui";
import { useDebounced } from "../../hooks/useDebounced";
import { api } from "../../services/api";
import { colors, space } from "../../theme";

export default function WorkoutScreen() {
  const [search, setSearch] = useState("");
  const [muscleId, setMuscleId] = useState<string | null>(null);
  const q = useDebounced(search);

  const muscles = useQuery({ queryKey: ["muscle-groups"], queryFn: () => api<LookupDTO[]>("/lookups/muscle-groups") });
  const list = useQuery({
    queryKey: ["exercises", q, muscleId],
    queryFn: () => api<Paginated<ExerciseDTO>>("/exercises", { query: { q, muscleId, limit: 100 } }),
  });

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, gap: space.sm }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.sm }}>
          <Card title="Today's workout">
            <EmptyNote>No plan assigned yet. Workout plans and the live workout logger arrive in the next release.</EmptyNote>
          </Card>
          <Text style={[styles.cardTitle, { marginTop: space.sm }]}>Exercise library</Text>
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
          <ErrorNote error={list.error} />
        </View>
      }
      data={list.data?.items ?? []}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => (
        <Link href={{ pathname: "/exercise/[id]", params: { id: item.id } }} asChild>
          <Pressable style={[styles.card, { paddingVertical: space.md }]}>
            <Text style={styles.listTitle}>{item.name}</Text>
            <Text style={styles.muted}>
              {[item.primaryMuscle?.name, item.equipment?.name, enumLabel(item.exerciseType)].filter(Boolean).join(" · ")}
            </Text>
          </Pressable>
        </Link>
      )}
      ListEmptyComponent={list.isLoading ? undefined : <EmptyNote>No exercises found.</EmptyNote>}
    />
  );
}
