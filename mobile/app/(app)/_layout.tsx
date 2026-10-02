import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function AppLayout() {
  const dark = useColorScheme() === "dark";
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: dark ? "#0c0b10" : "#f8fafc" },
        headerTintColor: dark ? "#fafafa" : "#0f172a",
        headerTitleStyle: { fontFamily: "SpaceGrotesk_700Bold" },
        contentStyle: { backgroundColor: dark ? "#0c0b10" : "#f8fafc" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: "New Campaign" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="campaigns/index" options={{ title: "Campaigns" }} />
      <Stack.Screen name="campaigns/[id]/index" options={{ title: "Campaign" }} />
      <Stack.Screen name="campaigns/[id]/content" options={{ title: "Content" }} />
      <Stack.Screen name="campaigns/[id]/video" options={{ title: "Videos" }} />
      <Stack.Screen name="artists/index" options={{ title: "Artists" }} />
      <Stack.Screen name="artists/[id]" options={{ title: "Artist" }} />
      <Stack.Screen name="releases/index" options={{ title: "Releases" }} />
      <Stack.Screen name="releases/new" options={{ title: "New Release" }} />
      <Stack.Screen name="releases/[id]/index" options={{ title: "Release" }} />
      <Stack.Screen name="releases/[id]/edit" options={{ title: "Edit Release" }} />
      <Stack.Screen name="releases/[id]/calendar" options={{ title: "Calendar" }} />
      <Stack.Screen name="releases/[id]/content" options={{ title: "Release Content" }} />
    </Stack>
  );
}
