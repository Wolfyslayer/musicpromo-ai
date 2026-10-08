import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthContext";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme";

/** Shown while browsing signed out — matches web “browse freely, auth for actions”. */
export function GuestBanner() {
  const { isAuthenticated } = useAuth();
  const { colors } = useAppTheme();
  if (isAuthenticated) return null;

  return (
    <View
      style={[styles.box, { backgroundColor: colors.secondary, borderColor: colors.border }]}
      accessibilityRole="summary"
    >
      <View style={styles.copy}>
        <Text variant="bodyStrong">Browsing as guest</Text>
        <Text muted variant="caption">
          Explore the app. Sign in to create campaigns, upload media, or save changes.
        </Text>
      </View>
      <Button
        title="Sign in"
        variant="primary"
        onPress={() => router.push("/(auth)/login")}
        style={styles.btn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  copy: { gap: 2, flex: 1 },
  btn: { alignSelf: "flex-start" },
});
