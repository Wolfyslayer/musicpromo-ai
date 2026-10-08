import { ReactNode } from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { Text } from "./Text";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing, touchTarget } from "@/theme";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  labelRight?: ReactNode;
};

export function Input({ label, error, style, leftIcon, labelRight, ...rest }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      {label || labelRight ? (
        <View style={styles.labelRow}>
          {label ? (
            <Text variant="label" style={styles.label}>
              {label}
            </Text>
          ) : (
            <View />
          )}
          {labelRight}
        </View>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.border,
          },
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={label || rest.placeholder || "Text input"}
          style={[
            styles.input,
            { color: colors.foreground, paddingLeft: leftIcon ? 0 : spacing.lg },
            style,
          ]}
          {...rest}
        />
      </View>
      {error ? (
        <Text variant="caption" color={colors.destructive} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 2,
  },
  label: {},
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  icon: { paddingLeft: spacing.md, paddingRight: spacing.sm },
  input: {
    flex: 1,
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
});
