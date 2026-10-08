import { Text as RNText, TextProps, StyleSheet } from "react-native";
import { useAppTheme } from "@/theme/ThemeProvider";
import { typography } from "@/theme";

type Variant = keyof typeof typography;

type Props = TextProps & {
  variant?: Variant;
  muted?: boolean;
  color?: string;
};

export function Text({ variant = "body", muted, color, style, ...rest }: Props) {
  const { colors } = useAppTheme();
  return (
    <RNText
      style={[
        typography[variant],
        { color: color || (muted ? colors.mutedForeground : colors.foreground) },
        style,
      ]}
      {...rest}
    />
  );
}

export const textStyles = StyleSheet.create({});
