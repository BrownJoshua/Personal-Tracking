import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { SERVING_UNITS, customFoodSchema, enumLabel, firstFieldErrors, type ServingUnit } from "@recomptrack/shared";
import { Button, Card, Choice, ErrorNote, Screen, TextField, styles } from "../../components/ui";
import { ApiError, api } from "../../services/api";

const FIELDS = [
  ["calories", "Calories (kcal)"],
  ["protein", "Protein (g)"],
  ["carbohydrates", "Carbohydrates (g)"],
  ["fat", "Fat (g)"],
  ["fibre", "Fibre (g, optional)"],
] as const;

export default function CustomFoodScreen() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [basis, setBasis] = useState("100");
  const [unit, setUnit] = useState<ServingUnit>("GRAM");
  const [n, setN] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: unknown) => api("/nutrition/custom-foods", { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nutrition", "custom-foods"] });
      router.back();
    },
    onError: (e) => e instanceof ApiError && e.details && setErrors(e.fieldErrors()),
  });
  const num = (v?: string) => (v === undefined || v.trim() === "" ? undefined : Number(v.replace(",", ".")));

  function submit() {
    const body = {
      name,
      brand,
      servingBasis: num(basis),
      servingUnit: unit,
      nutrition: { calories: num(n.calories), protein: num(n.protein), carbohydrates: num(n.carbohydrates), fat: num(n.fat), fibre: num(n.fibre) ?? 0 },
    };
    const parsed = customFoodSchema.safeParse(body);
    if (!parsed.success) return setErrors(firstFieldErrors(parsed.error));
    setErrors({});
    save.mutate(body);
  }

  return (
    <Screen>
      <Text style={styles.muted}>Custom foods are private to you. Copy the values from the label.</Text>
      <Card>
        <TextField label="Name" value={name} onChangeText={setName} error={errors.name} />
        <TextField label="Brand (optional)" value={brand} onChangeText={setBrand} />
        <TextField label="Values are per" keyboardType="decimal-pad" value={basis} onChangeText={setBasis} error={errors.servingBasis} />
        <Choice options={SERVING_UNITS.map((u) => ({ value: u, label: enumLabel(u) }))} value={unit} onChange={setUnit} />
      </Card>
      <Card title="Nutrition">
        {FIELDS.map(([k, label]) => (
          <TextField key={k} label={label} keyboardType="decimal-pad" value={n[k] ?? ""} onChangeText={(v) => setN({ ...n, [k]: v })} error={errors[`nutrition.${k}`]} />
        ))}
      </Card>
      <ErrorNote error={save.error && !(save.error instanceof ApiError && save.error.details) ? save.error : null} />
      <Button title="Save food" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
