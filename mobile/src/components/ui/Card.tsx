import { Pressable, StyleSheet, View, ViewProps } from "react-native";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, shadows, spacing } from "@/theme";

type Props = ViewProps & {
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Card({ onPress, style, children, accessibilityLabel, ...rest }: Props) {
  const { colors } = useAppTheme();
  const content = (
    <View
      style={[
        styles.card,
        shadows.soft,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
});
