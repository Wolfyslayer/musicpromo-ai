import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
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
  leftIcon?: ReactNode;
  /** Slightly taller auth CTAs (matches web h-12). */
  size?: "md" | "lg";
};

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
  accessibilityHint,
  leftIcon,
  size = "md",
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
          : variant === "ghost"
            ? "transparent"
            : colors.card;

  const fg =
    variant === "primary" || variant === "destructive"
      ? colors.primaryForeground
      : colors.foreground;

  const border =
    variant === "outline"
      ? { borderWidth: 1, borderColor: colors.border }
      : null;

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
        size === "lg" ? styles.lg : null,
        { backgroundColor: bg, opacity: busy ? 0.55 : pressed ? 0.88 : 1 },
        border,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <Text variant="bodyStrong" color={fg}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  lg: {
    minHeight: 48,
    borderRadius: radius.lg,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: { marginRight: 2 },
});
