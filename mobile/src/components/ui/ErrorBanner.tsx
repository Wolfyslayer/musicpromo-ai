import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme";

type Props = {
  message: string;
  onRetry?: () => void;
};

export function ErrorBanner({ message, onRetry }: Props) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.box, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive }]}
      accessibilityRole="alert"
    >
      <Text color={colors.destructive} variant="label">
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          hitSlop={8}
        >
          <Text variant="bodyStrong" color={colors.destructive}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
