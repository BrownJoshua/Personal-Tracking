import { useState } from "react";
import { Text, View } from "react-native";
import { useLogMeasurement } from "../hooks/useMeasurements";
import { space } from "../theme";
import { Button, ErrorNote, TextField, styles } from "./ui";

/** Morning weigh-in. Each entry is a new record; nothing is overwritten. */
export function WeightEntry() {
  const [value, setValue] = useState("");
  const log = useLogMeasurement();
  const n = Number(value.replace(",", "."));
  const valid = value.trim() !== "" && Number.isFinite(n) && n >= 25 && n <= 400;

  return (
    <View style={{ gap: space.sm }}>
      <TextField label="Weight (kg)" keyboardType="decimal-pad" value={value} onChangeText={setValue} placeholder="e.g. 74.2" />
      <ErrorNote error={log.error} />
      {log.isSuccess && <Text style={styles.muted}>Saved.</Text>}
      <Button
        title="Log weight"
        disabled={!valid}
        loading={log.isPending}
        onPress={() => log.mutate({ weightKg: n }, { onSuccess: () => setValue("") })}
      />
    </View>
  );
}
