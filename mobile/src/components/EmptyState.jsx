import { View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";

export default function EmptyState({ icon, title, description, action, className }) {
  return (
    <View className={cn("items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-14", className)}>
      {icon ? (
        <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
          <Icon as={icon} size={28} className="text-muted-foreground" />
        </View>
      ) : null}
      <Text className="text-center font-heading text-lg">{title}</Text>
      {description ? <Text className="mt-1.5 max-w-sm text-center text-sm text-muted-foreground">{description}</Text> : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}
