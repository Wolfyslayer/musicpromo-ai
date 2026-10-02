import { Pressable, ScrollView, Switch as RNSwitch, View } from "react-native";
import RNSlider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { cn } from "@/lib/utils";
import { BRAND_GRADIENT, useThemeColors } from "@/lib/theme";
import { Text } from "./text";

export function Switch({ checked, onCheckedChange, disabled }) {
  const colors = useThemeColors();
  return (
    <RNSwitch
      value={Boolean(checked)}
      onValueChange={onCheckedChange}
      disabled={disabled}
      trackColor={{ false: colors.muted, true: colors.primary }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={colors.muted}
    />
  );
}

export function Slider({ value, onValueChange, min = 0, max = 100, step = 1, disabled }) {
  const colors = useThemeColors();
  return (
    <RNSlider
      value={Number(value) || 0}
      onValueChange={onValueChange}
      minimumValue={min}
      maximumValue={max}
      step={step}
      disabled={disabled}
      minimumTrackTintColor={colors.primary}
      maximumTrackTintColor={colors.muted}
      thumbTintColor={colors.primary}
    />
  );
}

export function ProgressBar({ value = 0, className, showLabel = false }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View className="w-full">
      <View className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
        <LinearGradient colors={BRAND_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${v}%`, height: "100%", borderRadius: 999 }} />
      </View>
      {showLabel ? <Text className="mt-1 text-right text-xs text-muted-foreground">{v}%</Text> : null}
    </View>
  );
}

/** Segmented control standing in for Radix Tabs. Render the active panel yourself based on `value`. */
export function Tabs({ value, onValueChange, items, className }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={cn("gap-1 rounded-xl bg-muted/60 p-1", className)}>
      {items.map((item) => {
        const id = typeof item === "object" ? item.value : item;
        const label = typeof item === "object" ? item.label : item;
        const active = id === value;
        return (
          <Pressable
            key={id}
            onPress={() => onValueChange?.(id)}
            className={cn("min-h-9 justify-center rounded-lg px-3", active ? "bg-background" : "bg-transparent")}
          >
            <Text className={cn("text-xs font-600", active ? "text-foreground" : "text-muted-foreground")}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Toggleable pill used for multi-select chips (platforms, goals, genres). */
export function Chip({ selected, onPress, children, className }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "min-h-9 flex-row items-center gap-1.5 rounded-full border px-3",
        selected ? "border-primary/50 bg-primary/15" : "border-border bg-muted/30",
        className
      )}
    >
      {typeof children === "string" ? (
        <Text className={cn("text-xs font-500", selected ? "text-primary" : "text-muted-foreground")}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function Card({ className, children }) {
  return <View className={cn("gap-3 rounded-2xl border border-border/60 bg-card p-4", className)}>{children}</View>;
}

export function Separator({ className }) {
  return <View className={cn("h-px w-full bg-border/60", className)} />;
}
