import { useQuery } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MEAL_TYPES, enumLabel, scaleNutrition, type FoodDTO, type MealType } from "@recomptrack/shared";
import { Button, Card, Choice, ErrorNote, Row, Screen, TextField, styles } from "../../components/ui";
import { useNutritionMutations } from "../../hooks/useNutrition";
import { api } from "../../services/api";
import { colors, space } from "../../theme";

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color }}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export default function FoodDetailScreen() {
  const params = useLocalSearchParams<{ id: string; meal?: MealType; date?: string }>();
  const q = useQuery({ queryKey: ["food", params.id], queryFn: () => api<FoodDTO>(`/foods/${params.id}`), enabled: !!params.id });
  const m = useNutritionMutations();
  const [qty, setQty] = useState("");
  const [meal, setMeal] = useState<MealType>((params.meal as MealType) ?? "SNACK");
  const f = q.data;
  const unit = f?.servingUnit === "MILLILITRE" ? "ml" : "g";
  const quantity = qty === "" ? (f?.servingSizes[0]?.quantity ?? f?.servingBasis ?? 100) : Number(qty.replace(",", "."));
  const valid = Number.isFinite(quantity) && quantity > 0;
  const n = f && valid ? scaleNutrition(f.nutrition, f.servingBasis, quantity) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: f?.name ?? "Food" }} />
      <ErrorNote error={q.error} />
      {q.isLoading && <ActivityIndicator color={colors.primary} />}
      {f && (
        <>
          <Card>
            <Text style={styles.h2}>{f.name}</Text>
            <Text style={styles.muted}>{[f.brand ?? "Generic", enumLabel(f.category), `values for ${enumLabel(f.preparation).toLowerCase()} weight`].join(" · ")}</Text>
          </Card>
          <Card title="Amount">
            <TextField label={`Amount (${unit})`} keyboardType="decimal-pad" value={qty} placeholder={String(quantity)} onChangeText={setQty} error={valid ? undefined : "Enter an amount"} />
            {f.servingSizes.length > 0 && (
              <View style={styles.pills}>
                {f.servingSizes.map((s) => (
                  <Pressable key={s.label} style={styles.pill} onPress={() => setQty(String(s.quantity))}>
                    <Text style={styles.pillText}>{s.label} ({s.quantity} {unit})</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {f.preparation !== "AS_PACKAGED" && <Text style={styles.muted}>Weigh it {f.preparation === "COOKED" ? "after" : "before"} cooking to match these values.</Text>}
          </Card>
          {n && (
            <Card title={`For ${quantity} ${unit}`}>
              <Text style={styles.bigNumber}>{n.calories} kcal</Text>
              <Row style={{ marginTop: space.sm }}>
                <Macro label="Protein g" value={n.protein} color={colors.protein} />
                <Macro label="Carbs g" value={n.carbohydrates} color={colors.carbs} />
                <Macro label="Fat g" value={n.fat} color={colors.fat} />
                <Macro label="Fibre g" value={n.fibre} color={colors.fibre} />
              </Row>
            </Card>
          )}
          <Card title="Add to diary">
            <Choice options={MEAL_TYPES.map((x) => ({ value: x, label: enumLabel(x) }))} value={meal} onChange={setMeal} />
            <ErrorNote error={m.addLog.error} />
            <Button
              title={`Add to ${enumLabel(meal).toLowerCase()}`}
              disabled={!valid}
              loading={m.addLog.isPending}
              onPress={() => m.addLog.mutate({ foodId: f.id, quantity, mealType: meal, localDate: params.date || undefined }, { onSuccess: () => router.back() })}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}
