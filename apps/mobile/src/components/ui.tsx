import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, space } from "../theme";

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const inner = <View style={padded ? styles.padded : undefined}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={["left", "right"]}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Card({ title, children, style, right }: { title?: string; children: ReactNode; style?: ViewStyle; right?: ReactNode }) {
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <View style={styles.cardHeader}>
          {title && <Text style={styles.cardTitle}>{title}</Text>}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
        (disabled || loading) && { opacity: 0.55 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#fff" : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, { color: isPrimary ? "#fff" : variant === "danger" ? colors.danger : colors.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function TextField({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? { borderColor: colors.danger } : null]}
        accessibilityLabel={label}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Horizontal pill selector for enum values. */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pills}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={[styles.pill, on && styles.pillOn]}
            >
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <Text style={[styles.error, { marginBottom: space.md }]}>{error instanceof Error ? error.message : "Something went wrong"}</Text>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: space.lg, gap: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius, padding: space.lg, borderWidth: 1, borderColor: colors.border, gap: space.sm },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 13, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  buttonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.border },
  buttonText: { fontSize: 16, fontWeight: "600" },
  field: { gap: space.xs },
  label: { fontSize: 14, fontWeight: "500", color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, backgroundColor: colors.surface, color: colors.text },
  error: { color: colors.danger, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 13 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surface },
  pillOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pillText: { color: colors.text },
  pillTextOn: { color: "#115E59", fontWeight: "600" },
  empty: { color: colors.muted, fontSize: 14 },
  h1: { fontSize: 28, fontWeight: "800", color: colors.text },
  bigNumber: { fontSize: 32, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  muted: { color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  listItem: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  listTitle: { fontSize: 16, fontWeight: "500", color: colors.text },
});
