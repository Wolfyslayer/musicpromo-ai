import '../global.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { queryClient } from '@/lib/query-client';
import { LoadingScreen } from '@/components/LoadingScreen';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function NavigationTree() {
  const { isLoadingAuth, isLoadingPublicSettings } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && !isLoadingPublicSettings) {
      SplashScreen.hideAsync();
    }
  }, [isLoadingAuth, isLoadingPublicSettings]);

  if (isLoadingAuth || isLoadingPublicSettings) {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(main)" />
      <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationTree />
      </AuthProvider>
    </QueryClientProvider>
  );
}
