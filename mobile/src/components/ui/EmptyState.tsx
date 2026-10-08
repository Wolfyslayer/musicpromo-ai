import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { spacing } from "@/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text variant="heading" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {description ? (
        <Text muted style={{ textAlign: "center" }}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.md }} />
      ) : null}
      <View style={[styles.dot, { backgroundColor: colors.muted }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
    gap: spacing.sm,
  },
  dot: { width: 0, height: 0 },
});
