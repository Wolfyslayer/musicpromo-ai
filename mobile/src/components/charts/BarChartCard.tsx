import { useMemo } from 'react';
import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import ChartCard, { formatCompact, useChartTextStyle, useChartWidth } from '@/components/charts/ChartCard';
import { useThemeColors } from '@/lib/theme';

export default function BarChartCard({
  title,
  data,
  color,
  height = 200,
  className,
}: {
  title: string;
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const colors = useThemeColors();
  const textStyle = useChartTextStyle();
  const { width, onLayout } = useChartWidth();
  const yAxisLabelWidth = 36;
  const available = Math.max(width - yAxisLabelWidth - 24, 0);
  const slot = data.length ? available / data.length : available;
  const barWidth = Math.max(14, Math.min(44, Math.floor(slot * 0.55)));
  const spacing = Math.max(8, Math.floor(slot - barWidth));
  const fill = color || colors.chart1;

  const barData = useMemo(
    () =>
      data.map((d) => ({
        value: Number(d.value) || 0,
        label: String(d.name).length > 9 ? `${String(d.name).slice(0, 8)}…` : String(d.name),
        frontColor: fill,
      })),
    [data, fill]
  );

  const maxValue = useMemo(() => {
    const m = Math.max(0, ...barData.map((b) => b.value));
    return m > 0 ? m : 10;
  }, [barData]);

  return (
    <ChartCard title={title} className={className}>
      <View onLayout={onLayout}>
        {width > 0 ? (
          <BarChart
            data={barData}
            width={available}
            height={height}
            barWidth={barWidth}
            spacing={spacing}
            initialSpacing={Math.floor(spacing / 2)}
            endSpacing={0}
            maxValue={maxValue}
            noOfSections={4}
            barBorderTopLeftRadius={6}
            barBorderTopRightRadius={6}
            yAxisLabelWidth={yAxisLabelWidth}
            yAxisTextStyle={textStyle}
            xAxisLabelTextStyle={{ ...textStyle, width: Math.max(barWidth + spacing - 4, 36), textAlign: 'center' }}
            formatYLabel={(label: string) => formatCompact(label)}
            rulesType="dashed"
            dashWidth={4}
            dashGap={4}
            rulesColor={colors.border}
            xAxisColor={colors.border}
            yAxisThickness={0}
            yAxisColor="transparent"
            isAnimated={false}
            disableScroll={slot * data.length <= available + 1}
            backgroundColor="transparent"
          />
        ) : null}
      </View>
    </ChartCard>
  );
}
