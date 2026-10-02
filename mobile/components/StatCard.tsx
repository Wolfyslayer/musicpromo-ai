import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

export default function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <View className="rounded-2xl border border-border bg-card/50 p-4">
      <View className="flex-row items-center gap-2">
        {Icon ? <Icon color="#8b5cf6" size={16} /> : null}
        <Text className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Text>
      </View>
      <Text className="mt-2 text-2xl font-bold text-foreground">{value}</Text>
    </View>
  );
}
