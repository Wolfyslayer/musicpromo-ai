import { View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";
import CopyButton from "@/components/CopyButton";

/**
 * Compact labeled text card for captions, hooks, hashtags, CTAs, etc.
 */
export default function PromoTextCard({ label, text, className = "" }) {
  if (!text) return null;
  return (
    <View className={cn("rounded-xl border border-border/50 bg-muted/30 p-3", className)}>
      <View className="mb-1.5 flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-[10px] font-700 uppercase tracking-wider text-muted-foreground">{label}</Text>
        <CopyButton text={text} label="Copy" />
      </View>
      <Text selectable className={label === "HASHTAGS" ? "font-mono text-xs text-primary" : "text-sm"}>
        {text}
      </Text>
    </View>
  );
}
