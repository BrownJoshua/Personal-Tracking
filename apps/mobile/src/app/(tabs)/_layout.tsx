import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { colors } from "../../theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false }}>
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: icon("today-outline") }} />
      <Tabs.Screen name="workout" options={{ title: "Workout", tabBarIcon: icon("barbell-outline") }} />
      <Tabs.Screen name="nutrition" options={{ title: "Nutrition", tabBarIcon: icon("nutrition-outline") }} />
      <Tabs.Screen name="progress" options={{ title: "Progress", tabBarIcon: icon("trending-up-outline") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("person-circle-outline") }} />
    </Tabs>
  );
}
