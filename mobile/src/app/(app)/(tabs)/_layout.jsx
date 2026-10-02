import { Tabs } from "expo-router";
import { Disc3, LayoutDashboard, ListMusic, Settings, Share2 } from "lucide-react-native";
import { useThemeColors } from "@/lib/theme";
import Logo from "@/components/Logo";
import { HeaderAuthButton } from "@/components/navigation";

const TABS = [
  { name: "index", title: "Dashboard", icon: LayoutDashboard },
  { name: "campaigns", title: "Campaigns", icon: ListMusic },
  { name: "releases", title: "Releases", icon: Disc3 },
  { name: "social", title: "Social", icon: Share2 },
  { name: "settings", title: "Settings", icon: Settings },
];

export default function TabsLayout() {
  const colors = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitle: () => <Logo size={26} />,
        headerTitleAlign: "left",
        headerRight: () => <HeaderAuthButton />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      {TABS.map(({ name, title, icon: TabIcon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{ title, tabBarIcon: ({ color, size }) => <TabIcon color={color} size={size - 2} /> }}
        />
      ))}
    </Tabs>
  );
}
