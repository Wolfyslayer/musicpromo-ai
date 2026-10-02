import type { ReactElement } from "react";
import { Platform, Text, View } from "react-native";

type Point = { name: string; value: number };

function Fallback({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  if (!data.length) {
    return <Text className="font-sans text-sm text-muted-foreground">No chart data yet.</Text>;
  }
  return (
    <View className="gap-3">
      {data.map((item) => (
        <View key={item.name} className="gap-1">
          <View className="flex-row justify-between">
            <Text className="font-sans text-xs text-foreground">{item.name}</Text>
            <Text className="font-sans text-xs text-muted-foreground">{item.value}</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-muted">
            <View className="h-2 rounded-full bg-primary" style={{ width: `${(item.value / max) * 100}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ViewsChart({ data }: { data: Point[] }) {
  if (Platform.OS === "web" || !data.length) return <Fallback data={data} />;
  const NativeChart = require("./ViewsChartNative").ViewsChartNative as (props: { data: Point[] }) => ReactElement;
  return <NativeChart data={data} />;
}
