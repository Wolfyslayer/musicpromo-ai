import '@/global.css';

import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthModal from '@/components/AuthModal';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/AuthContext';
import { queryClientInstance } from '@/lib/query-client';
import { palette } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

const TITLES: Record<string, string> = {
  'campaigns/index': 'Campaigns',
  'campaigns/[id]/index': 'Campaign',
  'campaigns/[id]/content': 'Content',
  'campaigns/[id]/video': 'Video Studio',
  create: 'New Campaign',
  'artists/index': 'Artists',
  'artists/[id]': 'Artist',
  'releases/index': 'Releases',
  'releases/new': 'New Release',
  'releases/[id]/index': 'Release',
  'releases/[id]/edit': 'Edit Release',
  'releases/[id]/calendar': 'Release Calendar',
  'releases/[id]/content': 'Release Content',
  'social/compose': 'Compose Post',
  settings: 'Settings',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  'forgot-password': 'Forgot Password',
  'reset-password': 'Reset Password',
};

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = palette[isDark ? 'dark' : 'light'];
  const [fontsLoaded, fontError] = useFonts({ SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, background: colors.background, card: colors.background, text: colors.foreground, border: colors.border, primary: colors.primary },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClientInstance}>
          <AuthProvider>
            <ThemeProvider value={theme}>
              <StatusBar style={isDark ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: colors.background } }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="register" options={{ headerShown: false }} />
                <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
                {Object.entries(TITLES).map(([name, title]) => (
                  <Stack.Screen key={name} name={name} options={{ title }} />
                ))}
              </Stack>
              <AuthModal />
              <Toaster />
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
