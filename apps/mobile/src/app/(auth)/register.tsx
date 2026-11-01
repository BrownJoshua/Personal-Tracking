import { useState } from "react";
import { Text } from "react-native";
import { firstFieldErrors, registerSchema } from "@recomptrack/shared";
import { Button, ErrorNote, Screen, TextField, styles } from "../../components/ui";
import { ApiError } from "../../services/api";
import { useAuth } from "../../store/auth";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setError(null);
    setBusy(true);
    try {
      await register(parsed.data.name, parsed.data.email, password);
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(e.fieldErrors());
      else setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.muted}>Your records are private to you. You choose what to share later.</Text>
      <TextField label="Name" autoComplete="name" textContentType="name" value={name} onChangeText={setName} error={errors.name} />
      <TextField label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} error={errors.email} />
      <TextField label="Password" secureTextEntry autoComplete="new-password" textContentType="newPassword" value={password} onChangeText={setPassword} error={errors.password} hint="At least 10 characters, with letters and numbers" />
      <ErrorNote error={error} />
      <Button title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}
