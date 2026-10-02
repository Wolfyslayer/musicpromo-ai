import { Stack } from "expo-router";
import { useAuth } from "@/lib/AuthContext";
import { useThemeColors } from "@/lib/theme";
import { stackScreenOptions } from "@/components/navigation";
import { LoadingState } from "@/components/Screen";

/**
 * Mirrors the web ProtectedRoute + Layout: guests may browse in preview mode,
 * and actions that need an account call `requireAuth`, which opens the login modal.
 */
export default function AppLayout() {
  const { isLoadingAuth, authChecked } = useAuth();
  const colors = useThemeColors();

  if (isLoadingAuth || !authChecked) return <LoadingState />;

  return (
    <Stack screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Home" }} />
      <Stack.Screen name="create" options={{ title: "New Campaign" }} />
      <Stack.Screen name="studio" options={{ title: "Video Studio" }} />
      <Stack.Screen name="analytics" options={{ title: "Analytics" }} />
      <Stack.Screen name="artists/index" options={{ title: "Artists" }} />
      <Stack.Screen name="artists/[id]" options={{ title: "Artist" }} />
      <Stack.Screen name="campaigns/[id]/index" options={{ title: "Campaign" }} />
      <Stack.Screen name="campaigns/[id]/content" options={{ title: "Campaign Content" }} />
      <Stack.Screen name="campaigns/[id]/video" options={{ title: "Video Studio" }} />
      <Stack.Screen name="releases/new" options={{ title: "New Release" }} />
      <Stack.Screen name="releases/[id]/index" options={{ title: "Release" }} />
      <Stack.Screen name="releases/[id]/edit" options={{ title: "Edit Release" }} />
      <Stack.Screen name="releases/[id]/calendar" options={{ title: "Release Calendar" }} />
      <Stack.Screen name="releases/[id]/content" options={{ title: "Release Content" }} />
      <Stack.Screen name="social/compose" options={{ title: "Compose Post" }} />
    </Stack>
  );
}
