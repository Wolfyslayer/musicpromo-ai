import { useMemo } from 'react';
import { View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import ChartCard, { CHART_SERIES_COLORS, ChartLegend, formatCompact, useChartWidth } from '@/components/charts/ChartCard';
import { useThemeColors } from '@/lib/theme';

export default function PieChartCard({
  title,
  data,
  colors: sliceColors = CHART_SERIES_COLORS,
  radius: radiusProp = 80,
  className,
}: {
  title: string;
  data: { name: string; value: number }[];
  colors?: string[];
  radius?: number;
  className?: string;
}) {
  const theme = useThemeColors();
  const { width, onLayout } = useChartWidth();
  const radius = Math.max(40, Math.min(radiusProp, width ? width / 2 - 8 : radiusProp));

  const slices = useMemo(
    () => data.map((d, i) => ({ value: Number(d.value) || 0, color: sliceColors[i % sliceColors.length], name: d.name })),
    [data, sliceColors]
  );
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const drawable = total > 0 ? slices : [{ value: 1, color: theme.border, name: '' }];

  return (
    <ChartCard title={title} className={className}>
      <View onLayout={onLayout} className="items-center">
        {width > 0 ? (
          <PieChart data={drawable} donut radius={radius} innerRadius={radius * 0.5} innerCircleColor={theme.card} strokeWidth={0} isAnimated={false} />
        ) : null}
      </View>
      <ChartLegend
        items={slices.map((s) => ({
          label: s.name,
          color: s.color,
          value: `${formatCompact(s.value)}${total > 0 ? ` (${Math.round((s.value / total) * 100)}%)` : ''}`,
        }))}
      />
    </ChartCard>
  );
}
