import { Stack } from "expo-router";
import { headerOptions } from "../../components/ui";

export default function AuthLayout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: "Create account" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
    </Stack>
  );
}
