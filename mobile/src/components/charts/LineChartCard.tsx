import { format, parseISO } from 'date-fns';
import { useMemo } from 'react';
import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import ChartCard, { ChartLegend, formatCompact, useChartTextStyle, useChartWidth } from '@/components/charts/ChartCard';
import { useThemeColors } from '@/lib/theme';

export type LineSeries = { key: string; label?: string; color: string };

function shortLabel(value: unknown) {
  const raw = String(value ?? '');
  try {
    const d = parseISO(raw);
    if (!Number.isNaN(d.getTime())) return format(d, 'MMM d');
  } catch {}
  return raw.slice(0, 8);
}

export default function LineChartCard({
  title,
  data,
  xKey,
  series,
  height = 200,
  showLegend,
  className,
}: {
  title: string;
  data: Record<string, any>[];
  xKey: string;
  series: LineSeries[];
  height?: number;
  showLegend?: boolean;
  className?: string;
}) {
  const colors = useThemeColors();
  const textStyle = useChartTextStyle();
  const { width, onLayout } = useChartWidth();
  const yAxisLabelWidth = 36;
  const chartWidth = Math.max(width - yAxisLabelWidth - 24, 0);

  const dataSet = useMemo(() => {
    const step = Math.max(1, Math.ceil(data.length / 4));
    return series.map((s, si) => ({
      color: s.color,
      thickness: 2,
      hideDataPoints: data.length > 14,
      dataPointsColor: s.color,
      dataPointsRadius: 3,
      data: data.map((row, i) => ({
        value: Number(row[s.key]) || 0,
        label: si === 0 && i % step === 0 ? shortLabel(row[xKey]) : '',
      })),
    }));
  }, [data, series, xKey]);

  const maxValue = useMemo(() => {
    const m = Math.max(0, ...data.flatMap((row) => series.map((s) => Number(row[s.key]) || 0)));
    return m > 0 ? m : 10;
  }, [data, series]);

  const spacing = data.length > 1 ? Math.max(chartWidth / (data.length - 1), 8) : chartWidth;

  return (
    <ChartCard title={title} className={className}>
      <View onLayout={onLayout}>
        {width > 0 ? (
          <LineChart
            dataSet={dataSet}
            width={chartWidth}
            height={height}
            curved
            spacing={spacing}
            initialSpacing={8}
            endSpacing={8}
            maxValue={maxValue}
            noOfSections={4}
            yAxisLabelWidth={yAxisLabelWidth}
            yAxisTextStyle={textStyle}
            xAxisLabelTextStyle={{ ...textStyle, width: 44, textAlign: 'center' }}
            formatYLabel={(label: string) => formatCompact(label)}
            rulesType="dashed"
            dashWidth={4}
            dashGap={4}
            rulesColor={colors.border}
            xAxisColor={colors.border}
            yAxisColor="transparent"
            yAxisThickness={0}
            disableScroll={spacing * (data.length - 1) <= chartWidth + 1}
            isAnimated={false}
            backgroundColor="transparent"
          />
        ) : null}
      </View>
      {(showLegend ?? series.length > 1) ? <ChartLegend items={series.map((s) => ({ label: s.label || s.key, color: s.color }))} /> : null}
    </ChartCard>
  );
}
