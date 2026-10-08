import { View, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { spacing, radius } from "@/theme";

export function OfflineBanner() {
  const { online, checked } = useNetworkStatus();
  if (!checked || online) return null;
  return (
    <View style={styles.box} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text color="#fff" variant="label">
        You’re offline. Changes will fail until connection returns.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#B45309",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
});
