import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create" options={{ title: 'Create Campaign' }} />
      <Stack.Screen name="campaigns/index" />
      <Stack.Screen name="campaigns/[id]/index" />
      <Stack.Screen name="campaigns/[id]/content" />
      <Stack.Screen name="campaigns/[id]/video" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="artists/index" />
      <Stack.Screen name="artists/[id]" />
      <Stack.Screen name="releases/index" />
      <Stack.Screen name="releases/new" />
      <Stack.Screen name="releases/[id]/index" />
      <Stack.Screen name="releases/[id]/edit" />
      <Stack.Screen name="releases/[id]/calendar" />
      <Stack.Screen name="releases/[id]/content" />
      <Stack.Screen name="social/compose" />
    </Stack>
  );
}
