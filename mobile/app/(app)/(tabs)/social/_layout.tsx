import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function SocialLayout() {
  const dark = useColorScheme() === "dark";
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: dark ? "#0c0b10" : "#f8fafc" },
        headerTintColor: dark ? "#fafafa" : "#0f172a",
        contentStyle: { backgroundColor: dark ? "#0c0b10" : "#f8fafc" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Social Hub" }} />
      <Stack.Screen name="compose" options={{ title: "Compose" }} />
    </Stack>
  );
}
