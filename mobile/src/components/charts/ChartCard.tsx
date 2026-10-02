import * as React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { palette, useThemeColors } from '@/lib/theme';
import { cn } from '@/lib/utils';

export const CHART_SERIES_COLORS = [palette.light.chart1, palette.light.chart2, palette.light.chart3, palette.light.chart4, palette.light.chart5, '#26d97f'];

export function formatCompact(value: number | string) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n * 10) / 10);
}

export function useChartWidth() {
  const [width, setWidth] = React.useState(0);
  const onLayout = React.useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
  }, []);
  return { width, onLayout };
}

export function useChartTextStyle() {
  const colors = useThemeColors();
  return { color: colors.mutedForeground, fontSize: 10 };
}

export function ChartLegend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  if (!items.length) return null;
  return (
    <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center gap-1.5">
          <View className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <Text className="text-xs text-muted-foreground">
            {item.label}
            {item.value ? ` · ${item.value}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <View className={cn('rounded-2xl border border-border/60 bg-card/50 p-4', className)}>
      <Text className="mb-3 text-sm font-semibold">{title}</Text>
      {children}
    </View>
  );
}
