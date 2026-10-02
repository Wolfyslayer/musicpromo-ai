import { Stack } from "expo-router";
import { useThemeColors } from "@/lib/theme";
import { stackScreenOptions } from "@/components/navigation";

export default function AuthGroupLayout() {
  const colors = useThemeColors();
  return (
    <Stack screenOptions={{ ...stackScreenOptions(colors), headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
