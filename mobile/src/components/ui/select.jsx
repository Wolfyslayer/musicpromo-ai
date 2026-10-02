import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";
import { Icon } from "./icon";

const normalize = (options = []) =>
  options.map((o) => (typeof o === "object" && o !== null ? { value: String(o.value), label: o.label ?? String(o.value) } : { value: String(o), label: String(o) }));

/**
 * Bottom-sheet picker replacing the Radix Select.
 * `options` accepts strings or { value, label }. Values are compared as strings, like the web SelectItem.
 */
export function Select({ value, onValueChange, options, placeholder = "Select…", title, className, disabled }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const items = normalize(options);
  const selected = items.find((o) => o.value === String(value ?? ""));

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className={cn(
          "h-11 flex-row items-center justify-between gap-2 rounded-xl border border-input bg-background px-3",
          disabled && "opacity-50",
          className
        )}
      >
        <Text className={cn("flex-1 text-sm", !selected && "text-muted-foreground")} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <Icon as={ChevronDown} size={16} className="text-muted-foreground" />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-black/50" onPress={() => setOpen(false)} />
          <View className="max-h-[70%] rounded-t-3xl border border-border bg-popover" style={{ paddingBottom: insets.bottom + 8 }}>
            <View className="items-center py-2">
              <View className="h-1 w-10 rounded-full bg-muted-foreground/40" />
            </View>
            {title ? <Text className="px-5 pb-2 font-heading text-base">{title}</Text> : null}
            <ScrollView contentContainerClassName="px-2 pb-2">
              {items.map((o) => {
                const active = o.value === String(value ?? "");
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      onValueChange?.(o.value);
                      setOpen(false);
                    }}
                    className={cn("min-h-12 flex-row items-center justify-between rounded-xl px-3 active:bg-muted", active && "bg-primary/10")}
                  >
                    <Text className={cn("flex-1 text-sm", active && "font-600 text-primary")}>{o.label}</Text>
                    {active ? <Icon as={Check} size={16} className="text-primary" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
