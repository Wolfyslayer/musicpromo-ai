import { View } from "react-native";
import { Bar, CartesianChart } from "victory-native";

type Point = { name: string; value: number };

export function ViewsChartNative({ data }: { data: Point[] }) {
  return (
    <View style={{ height: 220 }}>
      <CartesianChart data={data} xKey="name" yKeys={["value"]} domainPadding={{ left: 18, right: 18, top: 16 }}>
        {({ points, chartBounds }) => (
          <Bar points={points.value} chartBounds={chartBounds} color="#a164f7" roundedCorners={{ topLeft: 6, topRight: 6 }} />
        )}
      </CartesianChart>
    </View>
  );
}
