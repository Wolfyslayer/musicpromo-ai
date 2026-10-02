import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Path, Polyline } from "react-native-svg";

const PIE_COLORS = ["#a164f7", "#e85aad", "#2ad4e8", "#f5c542", "#e24b4b", "#3dbe74"];

export function SeriesChart({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: { key: string; color: string; label: string }[];
}) {
  const [width, setWidth] = useState(320);
  const height = 180;
  const pad = 8;
  const values = data.flatMap((row) => series.map((item) => Number(row[item.key]) || 0));
  const max = Math.max(1, ...values);
  const step = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;

  return (
    <View className="gap-2" onLayout={(event) => setWidth(Math.max(160, event.nativeEvent.layout.width))}>
      <Svg width={width} height={height}>
        {series.map((item) => {
          const points = data
            .map((row, index) => {
              const x = pad + index * step;
              const y = height - pad - ((Number(row[item.key]) || 0) / max) * (height - pad * 2);
              return `${x},${y}`;
            })
            .join(" ");
          return <Polyline key={item.key} points={points} fill="none" stroke={item.color} strokeWidth={2} />;
        })}
      </Svg>
      <View className="flex-row flex-wrap gap-3">
        {series.map((item) => (
          <View key={item.key} className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <Text className="font-sans text-xs text-muted-foreground">{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function pieSlice(cx: number, cy: number, radius: number, start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0;
  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(end);
  const y2 = cy + radius * Math.sin(end);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
}

export function ShareChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  let angle = -Math.PI / 2;
  const slices = data.map((item, index) => {
    const sweep = (item.value / total) * Math.PI * 2;
    const path = pieSlice(90, 90, 78, angle, angle + Math.max(sweep, 0.001));
    angle += sweep;
    return { ...item, path, color: PIE_COLORS[index % PIE_COLORS.length] };
  });

  return (
    <View className="items-center gap-3">
      <Svg width={180} height={180}>
        {slices.map((slice) => (
          <Path key={slice.name} d={slice.path} fill={slice.color} />
        ))}
      </Svg>
      <View className="w-full gap-1">
        {slices.map((slice) => (
          <View key={slice.name} className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
              <Text className="font-sans text-xs text-foreground">{slice.name}</Text>
            </View>
            <Text className="font-sans text-xs text-muted-foreground">{slice.value.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
