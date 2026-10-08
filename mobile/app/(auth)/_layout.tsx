import { Stack } from "expo-router";

/** Auth stack stays reachable from guest browse (no forced bounce when signed out). */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}
