import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors, gradients, radius, space } from "../theme";

/** Gradient backdrop with soft colour blobs — what the glass panels blur. */
export function Backdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={gradients.background} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, { top: -80, left: -60, backgroundColor: "rgba(45,212,191,0.28)" }]} />
      <View style={[styles.blob, { top: 180, right: -110, backgroundColor: "rgba(129,140,248,0.24)" }]} />
      <View style={[styles.blob, { bottom: -120, left: 40, backgroundColor: "rgba(236,72,153,0.14)" }]} />
    </View>
  );
}

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const inner = <View style={padded ? styles.padded : { flex: 1 }}>{children}</View>;
  return (
    <View style={styles.screen}>
      <Backdrop />
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </View>
  );
}

/** Frosted glass panel. */
export function Card({ title, children, style, right }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle>; right?: ReactNode }) {
  return (
    <View style={[styles.cardOuter, style]}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.cardInner}>
        {(title || right) && (
          <View style={styles.cardHeader}>
            {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
            {right}
          </View>
        )}
        {children}
      </View>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const filled = variant === "primary" || variant === "danger";
  const content = loading ? (
    <ActivityIndicator color={filled ? colors.primaryInk : colors.primary} />
  ) : (
    <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: filled ? colors.primaryInk : variant === "ghost" ? colors.primary : colors.text }]}>{title}</Text>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        !filled && (variant === "ghost" ? styles.buttonGhost : styles.buttonSecondary),
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] },
      ]}
    >
      {filled && <LinearGradient colors={variant === "danger" ? gradients.danger : gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />}
      {content}
    </Pressable>
  );
}

export function TextField({ label, error, hint, style, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="rgba(167,179,198,0.7)"
        selectionColor={colors.primary}
        style={[styles.input, error ? { borderColor: colors.danger } : null, style]}
        accessibilityLabel={label}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Pill selector for enum values. */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.pills} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={[styles.pill, on && styles.pillOn]}>
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Horizontal progress bar, e.g. protein eaten vs target. */
export function ProgressBar({ value, max, color = colors.primary }: { value: number; max: number | null; color?: string }) {
  const pct = max && max > 0 ? Math.min(1, value / max) : 0;
  const over = !!max && value > max * 1.05;
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(value), min: 0, max: max ?? undefined }}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? colors.warning : color }]} />
    </View>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
      {sub ? <Text style={[styles.muted, { fontSize: 12 }]}>{sub}</Text> : null}
    </View>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <Text style={[styles.error, { marginBottom: space.sm }]}>{error instanceof Error ? error.message : "Something went wrong"}</Text>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

/** Shared navigator styling for the dark glass theme. */
export const headerOptions = {
  headerStyle: { backgroundColor: colors.headerBg },
  headerTintColor: colors.primary,
  headerTitleStyle: { color: colors.text },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bgTop },
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgTop },
  padded: { padding: space.lg, gap: space.md },
  blob: { position: "absolute", width: 320, height: 320, borderRadius: 160, opacity: 0.9 },
  cardOuter: { borderRadius: radius, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.05)" },
  cardInner: { padding: space.lg, gap: space.sm },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
  button: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", overflow: "hidden", minHeight: 48 },
  buttonSmall: { paddingVertical: 8, minHeight: 36, borderRadius: 12 },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buttonGhost: { backgroundColor: "transparent" },
  buttonText: { fontSize: 16, fontWeight: "700" },
  field: { gap: space.xs },
  label: { fontSize: 14, fontWeight: "500", color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, backgroundColor: "rgba(255,255,255,0.07)", color: colors.text },
  error: { color: colors.danger, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 13 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surface },
  pillOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pillText: { color: colors.text },
  pillTextOn: { color: "#CCFBF1", fontWeight: "600" },
  empty: { color: colors.muted, fontSize: 14 },
  h1: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "700", color: colors.text },
  bigNumber: { fontSize: 32, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"], letterSpacing: -0.5 },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  muted: { color: colors.muted },
  text: { color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  listItem: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  listTitle: { fontSize: 16, fontWeight: "500", color: colors.text },
  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
