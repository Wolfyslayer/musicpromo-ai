import { View } from "react-native";
import { cn } from "@/lib/utils";
import { statusMeta } from "@/services/constants";
import { Text } from "@/components/ui/text";

const COLOR_MAP = {
  muted: { box: "bg-muted/40 border-border", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  primary: { box: "bg-primary/15 border-primary/30", text: "text-primary", dot: "bg-primary" },
  "chart-1": { box: "bg-chart-1/15 border-chart-1/30", text: "text-chart-1", dot: "bg-chart-1" },
  "chart-2": { box: "bg-chart-2/15 border-chart-2/30", text: "text-chart-2", dot: "bg-chart-2" },
  "chart-3": { box: "bg-chart-3/15 border-chart-3/30", text: "text-chart-3", dot: "bg-chart-3" },
};

export default function StatusBadge({ status, label, color, className }) {
  const meta = statusMeta(status);
  const c = COLOR_MAP[color || meta.color] || COLOR_MAP.muted;
  return (
    <View className={cn("flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-0.5", c.box, className)}>
      <View className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      <Text className={cn("text-xs font-500 capitalize", c.text)}>{label || meta.label}</Text>
    </View>
  );
}
