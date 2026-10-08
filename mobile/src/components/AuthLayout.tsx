import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Logo } from "@/components/Logo";
import { Text } from "@/components/ui/Text";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, shadows, spacing } from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Mirrors web AuthLayout: gradient wash, centered logo, icon badge,
 * title/subtitle, surface card, footer + continue browsing.
 */
export function AuthLayout({ title, subtitle, icon = "log-in-outline", footer, children }: Props) {
  const { colors, scheme } = useAppTheme();
  const wash =
    scheme === "dark"
      ? (["rgba(167,139,250,0.18)", colors.background, colors.background] as const)
      : (["rgba(139,92,246,0.14)", colors.background, colors.background] as const);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[...wash]} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={["top", "left", "right", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.column}>
              <OfflineBanner />

              <View style={styles.header}>
                <View style={styles.logoWrap}>
                  <Logo size={44} />
                </View>
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: colors.primary + "1F",
                      borderColor: colors.primary + "33",
                    },
                  ]}
                >
                  <Ionicons name={icon} size={24} color={colors.primary} />
                </View>
                <Text variant="title" style={styles.title}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text muted style={styles.subtitle}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>

              <View
                style={[
                  styles.surface,
                  shadows.soft,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border + "A6",
                  },
                ]}
              >
                {children}
              </View>

              {footer ? <View style={styles.footer}>{footer}</View> : null}

              <Pressable
                onPress={() => router.replace("/(app)/(tabs)")}
                accessibilityRole="button"
                accessibilityLabel="Continue browsing without signing in"
                hitSlop={8}
                style={styles.browse}
              >
                <Text muted variant="caption" style={{ textAlign: "center" }}>
                  Continue browsing
                </Text>
              </Pressable>

              <Text muted variant="caption" style={styles.legal}>
                Privacy · Terms
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing["3xl"],
  },
  column: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    gap: spacing.md,
  },
  header: { alignItems: "center", marginBottom: spacing.sm, gap: spacing.sm },
  logoWrap: { marginBottom: spacing.sm },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  title: { textAlign: "center" },
  subtitle: { textAlign: "center", fontSize: 15, lineHeight: 22 },
  surface: {
    borderRadius: radius["2xl"],
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing["2xl"],
    gap: spacing.lg,
  },
  footer: { alignItems: "center", marginTop: spacing.sm },
  browse: { paddingVertical: spacing.sm },
  legal: { textAlign: "center", marginTop: spacing.xs },
});
