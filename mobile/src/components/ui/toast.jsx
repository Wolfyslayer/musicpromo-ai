import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";
import { Text } from "./text";

/** Same call shape as the web `toast({ title, description, variant })`, without the Radix toaster. */
let toasts = [];
const listeners = new Set();
const emit = () => listeners.forEach((l) => l(toasts));
let counter = 0;

export function dismiss(id) {
  toasts = id ? toasts.filter((t) => t.id !== id) : [];
  emit();
}

export function toast({ title, description, variant, duration = 3500 } = {}) {
  const id = String(++counter);
  toasts = [...toasts, { id, title, description, variant }].slice(-3);
  emit();
  setTimeout(() => dismiss(id), duration);
  return { id, dismiss: () => dismiss(id) };
}

export function useToast() {
  return { toast, dismiss };
}

export function Toaster() {
  const [items, setItems] = useState(toasts);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    listeners.add(setItems);
    return () => listeners.delete(setItems);
  }, []);

  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 top-0 items-center gap-2 px-4" style={{ paddingTop: insets.top + 8 }}>
      {items.map((t) => (
        <Animated.View key={t.id} entering={FadeInUp} exiting={FadeOutUp} className="w-full max-w-md">
          <Pressable
            onPress={() => dismiss(t.id)}
            className={cn(
              "rounded-2xl border px-4 py-3 shadow-lg",
              t.variant === "destructive" ? "border-destructive/40 bg-destructive" : "border-border bg-popover"
            )}
          >
            {t.title ? (
              <Text className={cn("text-sm font-600", t.variant === "destructive" && "text-destructive-foreground")}>{t.title}</Text>
            ) : null}
            {t.description ? (
              <Text className={cn("mt-0.5 text-xs text-muted-foreground", t.variant === "destructive" && "text-destructive-foreground/90")}>
                {t.description}
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
