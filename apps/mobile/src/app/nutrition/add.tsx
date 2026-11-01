import { useQuery } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { enumLabel, type FoodDTO, type MealType, type Paginated } from "@recomptrack/shared";
import { QuantitySheet } from "../../components/QuantitySheet";
import { Button, Card, Choice, EmptyNote, ErrorNote, Row, Screen, styles } from "../../components/ui";
import { useDebounced } from "../../hooks/useDebounced";
import { useCustomFoods, useMealPlans, useNutritionMutations, useRecentFoods, useSavedMeals } from "../../hooks/useNutrition";
import { api } from "../../services/api";
import { colors } from "../../theme";

type Tab = "search" | "recent" | "mine" | "saved" | "plan";
type Pending = { title: string; unit: string; quantity: number; foodId?: string; customFoodId?: string };

export default function AddFoodScreen() {
  const params = useLocalSearchParams<{ meal?: MealType; date?: string }>();
  const meal = (params.meal ?? "SNACK") as MealType;
  const localDate = params.date || undefined;
  const [tab, setTab] = useState<Tab>("search");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const foods = useQuery({ queryKey: ["foods", q], queryFn: () => api<Paginated<FoodDTO>>("/foods", { query: { q, limit: 40 } }), enabled: tab === "search" });
  const recent = useRecentFoods();
  const custom = useCustomFoods();
  const saved = useSavedMeals();
  const plans = useMealPlans();
  const m = useNutritionMutations();
  const [pending, setPending] = useState<Pending | null>(null);

  const done = (msg: string) => {
    setPending(null);
    Alert.alert("Added", msg, [{ text: "Add more" }, { text: "Done", onPress: () => router.back() }]);
  };

  function logMeal(kind: "saved" | "plan", id: string, name: string) {
    const mutation = kind === "saved" ? m.logSavedMeal : m.logMealPlan;
    mutation.mutate(
      { id, mealType: meal, localDate },
      { onSuccess: (r) => done(`${name} added to ${enumLabel(meal).toLowerCase()}${r.skipped ? ` (${r.skipped} unavailable item skipped)` : ""}.`) },
    );
  }

  return (
    <Screen>
      <Text style={styles.muted}>Adding to {enumLabel(meal).toLowerCase()}{localDate ? ` · ${localDate}` : ""}</Text>
      <Choice
        options={[
          { value: "search", label: "Search" },
          { value: "recent", label: "Recent" },
          { value: "mine", label: "My foods" },
          { value: "saved", label: "Saved meals" },
          { value: "plan", label: "Meal plan" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ErrorNote error={m.logSavedMeal.error ?? m.logMealPlan.error} />

      {tab === "search" && (
        <>
          <TextInput placeholder="Search foods or brands" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.input} autoFocus accessibilityLabel="Search foods" />
          <ErrorNote error={foods.error} />
          {foods.data?.items.map((f) => (
            <Link key={f.id} href={{ pathname: "/food/[id]", params: { id: f.id, meal, date: localDate ?? "" } }} asChild>
              <Pressable>
                <Card>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Text style={[styles.listTitle, { flex: 1 }]}>{f.name}</Text>
                    <Text style={styles.text}>{f.nutrition.calories} kcal</Text>
                  </Row>
                  <Text style={styles.muted}>
                    {[f.brand, enumLabel(f.preparation), `per ${f.servingBasis} ${f.servingUnit === "GRAM" ? "g" : "ml"}`].filter(Boolean).join(" · ")}
                  </Text>
                </Card>
              </Pressable>
            </Link>
          ))}
          {foods.data?.items.length === 0 && <EmptyNote>No foods found. Add your own under “My foods”.</EmptyNote>}
        </>
      )}

      {tab === "recent" &&
        (recent.data?.length ? (
          recent.data.map((r) => (
            <Pressable key={`${r.foodId}${r.customFoodId}`} onPress={() => setPending({ title: r.name, unit: r.unit, quantity: r.lastQuantity, foodId: r.foodId ?? undefined, customFoodId: r.customFoodId ?? undefined })}>
              <Card>
                <Text style={styles.listTitle}>{r.name}</Text>
                <Text style={styles.muted}>{r.brand ? `${r.brand} · ` : ""}last {r.lastQuantity} {r.unit}</Text>
              </Card>
            </Pressable>
          ))
        ) : (
          <EmptyNote>Foods you log will appear here.</EmptyNote>
        ))}

      {tab === "mine" && (
        <>
          <Button title="+ New custom food" variant="secondary" onPress={() => router.push("/nutrition/custom-food")} />
          {custom.data?.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setPending({ title: c.name, unit: c.servingUnit === "GRAM" ? "g" : "ml", quantity: c.servingBasis, customFoodId: c.id })}
              onLongPress={() => Alert.alert("Delete food", `Delete ${c.name}? Past diary entries are kept.`, [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => m.deleteCustomFood.mutate(c.id) }])}
            >
              <Card>
                <Text style={styles.listTitle}>{c.name}</Text>
                <Text style={styles.muted}>
                  {c.nutrition.calories} kcal per {c.servingBasis} {c.servingUnit === "GRAM" ? "g" : "ml"} · private to you
                </Text>
              </Card>
            </Pressable>
          ))}
          {custom.data?.length === 0 && <EmptyNote>No custom foods yet.</EmptyNote>}
        </>
      )}

      {tab === "saved" &&
        (saved.data?.length ? (
          saved.data.map((s) => (
            <Card key={s.id} title={`${Math.round(s.totals.calories)} kcal`}>
              <Text style={styles.listTitle}>{s.name}</Text>
              <Text style={styles.muted}>{s.items.map((i) => `${i.name} ${i.quantity}${i.unit}`).join(" · ")}</Text>
              <Row>
                <View style={{ flex: 1 }}><Button small title="Log this meal" onPress={() => logMeal("saved", s.id, s.name)} loading={m.logSavedMeal.isPending} /></View>
                <View style={{ flex: 1 }}><Button small variant="ghost" title="Delete" onPress={() => m.deleteSavedMeal.mutate(s.id)} /></View>
              </Row>
            </Card>
          ))
        ) : (
          <EmptyNote>Use “Save as meal” on a diary meal to reuse it here.</EmptyNote>
        ))}

      {tab === "plan" &&
        (plans.data?.length ? (
          plans.data.map((p) => (
            <Card key={p.id} title={`${enumLabel(p.mealTemplate.mealType)} · ${Math.round(p.mealTemplate.totalNutrition.calories)} kcal`}>
              <Text style={styles.listTitle}>{p.mealTemplate.name}</Text>
              <Text style={styles.muted}>{p.mealTemplate.ingredients.map((i) => `${i.name} ${i.quantity}${i.unit}`).join(" · ")}</Text>
              <Button small title="Log this meal" onPress={() => logMeal("plan", p.id, p.mealTemplate.name)} loading={m.logMealPlan.isPending} />
            </Card>
          ))
        ) : (
          <EmptyNote>No meal plan assigned.</EmptyNote>
        ))}

      <QuantitySheet
        visible={!!pending}
        title={pending?.title ?? ""}
        unit={pending?.unit ?? "g"}
        initialQuantity={pending?.quantity ?? 100}
        initialMeal={meal}
        confirmLabel="Add to diary"
        busy={m.addLog.isPending}
        error={m.addLog.error}
        onClose={() => setPending(null)}
        onConfirm={(quantity, mealType) =>
          pending && m.addLog.mutate({ foodId: pending.foodId, customFoodId: pending.customFoodId, quantity, mealType, localDate }, { onSuccess: () => done(`${pending.title} added.`) })
        }
      />
    </Screen>
  );
}
