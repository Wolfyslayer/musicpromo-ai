import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { useAppTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme";

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text muted>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
    gap: spacing.md,
  },
});
