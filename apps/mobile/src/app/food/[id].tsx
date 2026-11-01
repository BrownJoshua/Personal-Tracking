import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { enumLabel, scaleNutrition, type FoodDTO } from "@recomptrack/shared";
import { Card, ErrorNote, Screen, TextField, styles } from "../../components/ui";
import { api } from "../../services/api";
import { colors, space } from "../../theme";

function Macro({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color }}>{value}</Text>
      <Text style={styles.muted}>
        {label} ({unit})
      </Text>
    </View>
  );
}

export default function FoodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ["food", id], queryFn: () => api<FoodDTO>(`/foods/${id}`), enabled: !!id });
  const [qty, setQty] = useState<string>("");
  const f = q.data;
  const unit = f?.servingUnit === "MILLILITRE" ? "ml" : "g";
  const quantity = qty === "" ? (f?.servingBasis ?? 100) : Number(qty.replace(",", "."));
  const valid = Number.isFinite(quantity) && quantity >= 0;
  const n = f && valid ? scaleNutrition(f.nutrition, f.servingBasis, quantity) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: f?.name ?? "Food" }} />
      <ErrorNote error={q.error} />
      {q.isLoading && <ActivityIndicator color={colors.primary} />}
      {f && (
        <>
          <Card>
            <Text style={styles.listTitle}>{f.name}</Text>
            <Text style={styles.muted}>
              {[f.brand ?? "Generic", enumLabel(f.category), `values for ${enumLabel(f.preparation).toLowerCase()} weight`].join(" · ")}
            </Text>
          </Card>
          <Card title="Quantity">
            <TextField label={`Amount (${unit})`} keyboardType="decimal-pad" value={qty} placeholder={String(f.servingBasis)} onChangeText={setQty} error={valid ? undefined : "Enter a valid amount"} />
            {f.servingSizes.length > 0 && (
              <View style={styles.pills}>
                {f.servingSizes.map((s) => (
                  <Pressable key={s.label} style={styles.pill} onPress={() => setQty(String(s.quantity))}>
                    <Text style={styles.pillText}>
                      {s.label} ({s.quantity} {unit})
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {f.preparation !== "AS_PACKAGED" && (
              <Text style={styles.muted}>Weigh it {f.preparation === "COOKED" ? "after" : "before"} cooking to match these values.</Text>
            )}
          </Card>
          {n && (
            <Card title={`Nutrition for ${quantity} ${unit}`}>
              <Text style={styles.bigNumber}>{n.calories} kcal</Text>
              <View style={{ flexDirection: "row", marginTop: space.sm }}>
                <Macro label="Protein" value={n.protein} unit="g" color={colors.protein} />
                <Macro label="Carbs" value={n.carbohydrates} unit="g" color={colors.carbs} />
                <Macro label="Fat" value={n.fat} unit="g" color={colors.fat} />
                <Macro label="Fibre" value={n.fibre} unit="g" color={colors.fibre} />
              </View>
            </Card>
          )}
          <Text style={styles.muted}>Adding foods to your diary arrives in the next release.</Text>
        </>
      )}
    </Screen>
  );
}
