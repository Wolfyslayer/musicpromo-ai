import { Stack } from "expo-router";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useAuth } from "@/auth/AuthContext";
import { useAppTheme } from "@/theme/ThemeProvider";

/** App shell is reachable while signed out (browse). Writes use requireAuth. */
export default function AppLayout() {
  const { isLoadingAuth, authChecked } = useAuth();
  const { colors } = useAppTheme();

  if (isLoadingAuth || !authChecked) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="campaigns/create"
        options={{ headerShown: true, title: "New promo", presentation: "card" }}
      />
      <Stack.Screen name="campaigns/[id]/index" options={{ headerShown: true, title: "Campaign" }} />
      <Stack.Screen name="artists/[id]/index" options={{ headerShown: true, title: "Artist" }} />
      <Stack.Screen name="video/index" options={{ headerShown: true, title: "Video studio" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
