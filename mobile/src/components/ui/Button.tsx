import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Text } from "./Text";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing, touchTarget } from "@/theme";

type Variant = "primary" | "secondary" | "outline" | "destructive" | "ghost";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  accessibilityHint?: string;
};

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
  accessibilityHint,
}: Props) {
  const { colors } = useAppTheme();
  const busy = Boolean(loading || disabled);

  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "secondary"
        ? colors.secondary
        : variant === "destructive"
          ? colors.destructive
          : "transparent";

  const fg =
    variant === "primary" || variant === "destructive"
      ? colors.primaryForeground
      : variant === "secondary"
        ? colors.secondaryForeground
        : colors.foreground;

  const border =
    variant === "outline" ? { borderWidth: 1, borderColor: colors.border } : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: busy, busy: Boolean(loading) }}
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, opacity: busy ? 0.55 : pressed ? 0.88 : 1 },
        border,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text variant="bodyStrong" color={fg}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
