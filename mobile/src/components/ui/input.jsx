import { TextInput } from "react-native";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";

export function Input({ className, editable = true, ...props }) {
  const colors = useThemeColors();
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      editable={editable}
      className={cn(
        "h-11 rounded-xl border border-input bg-background px-3 text-base text-foreground",
        !editable && "opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }) {
  return (
    <Input
      multiline
      textAlignVertical="top"
      className={cn("h-auto min-h-24 py-2.5", className)}
      {...props}
    />
  );
}
