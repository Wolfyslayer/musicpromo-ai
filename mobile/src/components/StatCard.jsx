import { View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";

const ACCENTS = {
  primary: "text-primary",
  accent: "text-accent",
  "chart-3": "text-chart-3",
  "chart-1": "text-chart-1",
};

export default function StatCard({ label, value, icon, accent = "primary", sub, className }) {
  return (
    <View className={cn("flex-1 rounded-2xl border border-border/60 bg-card p-4", className)}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-500 uppercase tracking-wider text-muted-foreground">{label}</Text>
        {icon ? <Icon as={icon} size={16} className={ACCENTS[accent]} /> : null}
      </View>
      <Text className="mt-2 font-heading text-2xl tracking-tight">{value}</Text>
      {sub ? <Text className="mt-0.5 text-xs text-muted-foreground">{sub}</Text> : null}
    </View>
  );
}
