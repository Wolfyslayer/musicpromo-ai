import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/auth/AuthContext";
import { useAppTheme } from "@/theme/ThemeProvider";

/**
 * After session restore, enter the app shell for everyone (guest browse),
 * matching web ProtectedRoute which does not bounce signed-out users.
 */
export default function Index() {
  const { isLoadingAuth, authChecked } = useAuth();
  const { colors } = useAppTheme();

  if (isLoadingAuth || !authChecked) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading session" />
      </View>
    );
  }

  return <Redirect href="/(app)/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
