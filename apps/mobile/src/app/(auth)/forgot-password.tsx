import { useState } from "react";
import { Text } from "react-native";
import { Button, ErrorNote, Screen, TextField, styles } from "../../components/ui";
import { api } from "../../services/api";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
      setSent(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {sent ? (
        <Text style={styles.listTitle}>If that email is registered, a reset link is on its way.</Text>
      ) : (
        <>
          <Text style={styles.muted}>Enter your account email and we will send a reset link.</Text>
          <TextField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <ErrorNote error={error} />
          <Button title="Send reset link" onPress={submit} loading={busy} disabled={!email} />
        </>
      )}
    </Screen>
  );
}
