import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { enumLabel, type FoodDTO, type Paginated } from "@recomptrack/shared";
import { Card, EmptyNote, ErrorNote, styles } from "../../components/ui";
import { useDebounced } from "../../hooks/useDebounced";
import { api } from "../../services/api";
import { colors, space } from "../../theme";

export default function NutritionScreen() {
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const list = useQuery({
    queryKey: ["foods", q],
    queryFn: () => api<Paginated<FoodDTO>>("/foods", { query: { q, limit: 50 } }),
  });

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, gap: space.sm }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.sm }}>
          <Card title="Today">
            <EmptyNote>No food logged today. Diary logging arrives in the next release.</EmptyNote>
          </Card>
          <Text style={[styles.cardTitle, { marginTop: space.sm }]}>Food search</Text>
          <TextInput placeholder="Search foods or brands" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.input} accessibilityLabel="Search foods" />
          <ErrorNote error={list.error} />
        </View>
      }
      data={list.data?.items ?? []}
      keyExtractor={(f) => f.id}
      renderItem={({ item }) => (
        <Link href={{ pathname: "/food/[id]", params: { id: item.id } }} asChild>
          <Pressable style={[styles.card, { paddingVertical: space.md }]}>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={[styles.listTitle, { flex: 1 }]}>{item.name}</Text>
              <Text style={styles.listTitle}>{item.nutrition.calories} kcal</Text>
            </View>
            <Text style={styles.muted}>
              {[item.brand, enumLabel(item.preparation), `per ${item.servingBasis} ${item.servingUnit === "GRAM" ? "g" : "ml"}`, `P ${item.nutrition.protein} · C ${item.nutrition.carbohydrates} · F ${item.nutrition.fat}`]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </Pressable>
        </Link>
      )}
      ListEmptyComponent={list.isLoading ? undefined : <EmptyNote>No foods found.</EmptyNote>}
    />
  );
}
