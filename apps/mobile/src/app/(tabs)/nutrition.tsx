import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { MEAL_TYPES, addDays, enumLabel, type FoodLogDTO, type MealType } from "@recomptrack/shared";
import { MacroSummary } from "../../components/MacroSummary";
import { QuantitySheet } from "../../components/QuantitySheet";
import { Button, Card, EmptyNote, ErrorNote, Row, Screen, styles } from "../../components/ui";
import { useDiary, useNutritionMutations, useTargets } from "../../hooks/useNutrition";
import { colors, space } from "../../theme";

const label = (date: string, today: string) =>
  date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

export default function NutritionScreen() {
  const [date, setDate] = useState<string | undefined>(undefined);
  const diary = useDiary(date);
  const targets = useTargets();
  const m = useNutritionMutations();
  const [editing, setEditing] = useState<FoodLogDTO | null>(null);
  const d = diary.data;
  const current = d?.date ?? "";
  // "Today" in the user's time zone is whatever the server returns when no date is given.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    if (!date && d) setToday(d.date);
  }, [date, d]);

  function saveMeal(meal: MealType) {
    Alert.prompt?.("Save as meal", "Name this meal so you can log it again quickly.", (name) => {
      if (name?.trim()) m.saveMealFromDiary.mutate({ name: name.trim(), localDate: current, mealType: meal });
    });
    if (!Alert.prompt) m.saveMealFromDiary.mutate({ name: `${enumLabel(meal)} ${current}`, localDate: current, mealType: meal });
  }

  return (
    <Screen>
      <Row style={{ justifyContent: "space-between" }}>
        <Pressable accessibilityLabel="Previous day" onPress={() => current && setDate(addDays(current, -1))} style={styles.pill}><Text style={styles.text}>‹</Text></Pressable>
        <Text style={styles.h2}>{current ? label(current, today ?? current) : "…"}</Text>
        <Pressable accessibilityLabel="Next day" disabled={!!today && current >= today} onPress={() => current && setDate(addDays(current, 1))} style={[styles.pill, !!today && current >= today && { opacity: 0.3 }]}><Text style={styles.text}>›</Text></Pressable>
      </Row>
      <ErrorNote error={diary.error} />

      <Card title="Daily total" right={<Link href="/nutrition/history" style={{ color: colors.primary }}>History</Link>}>
        {d && <MacroSummary totals={d.totals} target={d.target} />}
        {targets.data && !targets.data.target && (
          <Text style={styles.muted}>Complete your profile ({targets.data.missing.join(", ")}) to get daily targets.</Text>
        )}
        {targets.data?.target?.method === "MANUAL" && <Text style={styles.muted}>Target set by your coach{targets.data.target.note ? `: ${targets.data.target.note}` : ""}.</Text>}
        {targets.data?.reviewDue && <Text style={{ color: colors.warning }}>Time to review your targets — log a fresh weigh-in.</Text>}
      </Card>

      {MEAL_TYPES.map((meal) => {
        const section = d?.meals[meal];
        return (
          <Card key={meal} title={enumLabel(meal)} right={<Text style={styles.muted}>{Math.round(section?.totals.calories ?? 0)} kcal</Text>}>
            {section?.entries.length ? (
              section.entries.map((e) => (
                <Pressable key={e.id} style={styles.listItem} onPress={() => setEditing(e)} accessibilityHint="Edit amount or remove">
                  <Row style={{ justifyContent: "space-between" }}>
                    <Text style={[styles.listTitle, { flex: 1 }]} numberOfLines={1}>{e.food.name}</Text>
                    <Text style={styles.text}>{Math.round(e.nutrition.calories)} kcal</Text>
                  </Row>
                  <Text style={styles.muted}>
                    {e.quantity} {e.unit} · P {e.nutrition.protein} · C {e.nutrition.carbohydrates} · F {e.nutrition.fat}
                  </Text>
                </Pressable>
              ))
            ) : (
              <EmptyNote>Nothing logged.</EmptyNote>
            )}
            <Row>
              <View style={{ flex: 1 }}>
                <Button small variant="secondary" title="+ Add food" onPress={() => router.push({ pathname: "/nutrition/add", params: { meal, date: current } })} />
              </View>
              {!!section?.entries.length && (
                <View style={{ flex: 1 }}><Button small variant="ghost" title="Save as meal" onPress={() => saveMeal(meal)} /></View>
              )}
            </Row>
          </Card>
        );
      })}
      <ErrorNote error={m.saveMealFromDiary.error} />
      {m.saveMealFromDiary.isSuccess && <Text style={{ color: colors.success }}>Meal saved — find it under Add food › Saved meals.</Text>}

      <QuantitySheet
        visible={!!editing}
        title={editing?.food.name ?? ""}
        unit={editing?.unit ?? "g"}
        initialQuantity={editing?.quantity ?? 100}
        initialMeal={editing?.mealType ?? "LUNCH"}
        confirmLabel="Save"
        busy={m.updateLog.isPending}
        error={m.updateLog.error ?? m.deleteLog.error}
        onClose={() => setEditing(null)}
        onConfirm={(quantity, mealType) => editing && m.updateLog.mutate({ id: editing.id, quantity, mealType }, { onSuccess: () => setEditing(null) })}
        onDelete={() => editing && m.deleteLog.mutate(editing.id, { onSuccess: () => setEditing(null) })}
      />
      <View style={{ height: space.md }} />
    </Screen>
  );
}
