import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { Text, Heading } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

/** Scrollable page body with the web app's soft brand glow (`.app-gradient`) and pull-to-refresh. */
export function Screen({ children, scroll = true, refreshing = false, onRefresh, className, contentClassName }) {
  const colors = useThemeColors();
  const glow = (
    <LinearGradient
      pointerEvents="none"
      colors={[`${colors.primary}26`, `${colors.accent}0D`, "transparent"]}
      locations={[0, 0.4, 1]}
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
    />
  );

  if (!scroll) {
    return (
      <View className={cn("flex-1 bg-background", className)}>
        {glow}
        {children}
      </View>
    );
  }

  return (
    <View className={cn("flex-1 bg-background", className)}>
      {glow}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName={cn("gap-5 px-4 pb-12 pt-4", contentClassName)}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function PageHeader({ title, subtitle, action, eyebrow }) {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <View className="flex-1 gap-1">
        {eyebrow ? <Text className="text-xs font-600 uppercase tracking-widest text-primary">{eyebrow}</Text> : null}
        <Heading className="text-3xl">{title}</Heading>
        {subtitle ? <Text className="text-sm text-muted-foreground">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function SectionTitle({ title, action }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-heading text-lg">{title}</Text>
      {action}
    </View>
  );
}

export function LoadingState({ label }) {
  const colors = useThemeColors();
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background py-24">
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text className="text-sm text-muted-foreground">{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <View className="items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-10">
      <Icon as={AlertTriangle} size={28} className="text-destructive" />
      <Text className="text-center font-heading text-base">{title}</Text>
      {message ? <Text className="text-center text-sm text-muted-foreground">{message}</Text> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" onPress={onRetry}>
          Try again
        </Button>
      ) : null}
    </View>
  );
}
