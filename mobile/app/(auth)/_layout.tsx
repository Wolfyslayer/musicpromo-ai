import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/auth/AuthContext";

export default function AuthLayout() {
  const { isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  if (!isLoadingAuth && authChecked && isAuthenticated) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}
