import { View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

export function Label({ className, ...props }) {
  return <Text className={cn("text-sm font-500 text-foreground", className)} {...props} />;
}

/** Label + control + optional hint, the most common form row in the web app. */
export function Field({ label, hint, className, children }) {
  return (
    <View className={cn("gap-1.5", className)}>
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
      {children}
      {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}
