import { Tabs } from 'expo-router';
import { BarChart3, Film, LayoutDashboard, Menu, Share2 } from 'lucide-react-native';

import Logo from '@/components/Logo';
import { useThemeColors } from '@/lib/theme';

const TABS = [
  { name: 'index', title: 'Dashboard', icon: LayoutDashboard },
  { name: 'studio', title: 'Studio', icon: Film },
  { name: 'social', title: 'Social', icon: Share2 },
  { name: 'analytics', title: 'Analytics', icon: BarChart3 },
  { name: 'more', title: 'More', icon: Menu },
] as const;

export default function TabLayout() {
  const colors = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}>
      {TABS.map(({ name, title, icon: IconCmp }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            headerTitle: name === 'index' ? () => <Logo size={26} /> : title,
            tabBarIcon: ({ color, size }) => <IconCmp color={color} size={size - 4} />,
          }}
        />
      ))}
    </Tabs>
  );
}
