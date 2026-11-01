import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MEAL_TYPES, enumLabel, type MealType } from "@recomptrack/shared";
import { colors, radius, space } from "../theme";
import { Button, Choice, ErrorNote, TextField, styles } from "./ui";

/** Bottom sheet to choose an amount (and meal) — used to add or edit diary entries. */
export function QuantitySheet({
  visible,
  title,
  unit,
  initialQuantity,
  initialMeal,
  confirmLabel,
  onConfirm,
  onDelete,
  onClose,
  busy,
  error,
  quantityLabel,
}: {
  visible: boolean;
  title: string;
  unit: string;
  initialQuantity: number;
  initialMeal: MealType;
  confirmLabel: string;
  onConfirm: (quantity: number, meal: MealType) => void;
  onDelete?: () => void;
  onClose: () => void;
  busy?: boolean;
  error?: unknown;
  quantityLabel?: string;
}) {
  const [qty, setQty] = useState(String(initialQuantity));
  const [meal, setMeal] = useState<MealType>(initialMeal);
  useEffect(() => {
    if (visible) {
      setQty(String(initialQuantity));
      setMeal(initialMeal);
    }
  }, [visible, initialQuantity, initialMeal]);
  const n = Number(qty.replace(",", "."));
  const valid = Number.isFinite(n) && n > 0;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(2,6,23,0.5)" }]} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View style={{ borderTopLeftRadius: radius + 6, borderTopRightRadius: radius + 6, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={{ padding: space.lg, paddingBottom: space.xl * 1.5, gap: space.md, backgroundColor: "rgba(13,27,46,0.55)" }}>
            <Text style={styles.h2}>{title}</Text>
            <TextField label={quantityLabel ?? `Amount (${unit})`} keyboardType="decimal-pad" value={qty} onChangeText={setQty} autoFocus selectTextOnFocus error={valid ? undefined : "Enter an amount"} />
            <Choice label="Meal" options={MEAL_TYPES.map((m) => ({ value: m, label: enumLabel(m) }))} value={meal} onChange={setMeal} />
            <ErrorNote error={error} />
            <Button title={confirmLabel} onPress={() => valid && onConfirm(n, meal)} disabled={!valid} loading={busy} />
            {onDelete && <Button title="Remove from diary" variant="danger" onPress={onDelete} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
