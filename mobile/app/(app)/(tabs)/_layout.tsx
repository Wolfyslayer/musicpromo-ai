import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { BarChart3, Clapperboard, Ellipsis, House, Share2 } from "lucide-react-native";

export default function TabsLayout() {
  const dark = useColorScheme() === "dark";
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: dark ? "#0c0b10" : "#f8fafc" },
        headerTintColor: dark ? "#fafafa" : "#0f172a",
        headerTitleStyle: { fontFamily: "SpaceGrotesk_700Bold" },
        tabBarActiveTintColor: "#a164f7",
        tabBarInactiveTintColor: dark ? "#a1a1aa" : "#64748b",
        tabBarStyle: {
          backgroundColor: dark ? "#16141c" : "#ffffff",
          borderTopColor: dark ? "#2c2833" : "#e2e8f0",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: "Studio",
          tabBarIcon: ({ color, size }) => <Clapperboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Share2 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <Ellipsis color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
