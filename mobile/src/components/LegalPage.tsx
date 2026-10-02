import { useRouter } from 'expo-router';
import * as React from 'react';
import { Linking, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';

const SUPPORT_EMAIL = 'support@flying-sonic-promo-flow.base44.app';

export function P({ children }: { children: React.ReactNode }) {
  return <RNText className="text-sm leading-6 text-muted-foreground">{children}</RNText>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return <Text className="mt-4 font-heading text-base text-foreground">{children}</Text>;
}

export function Ul({ children }: { children: React.ReactNode }) {
  return <View className="gap-1.5 pl-1">{children}</View>;
}

export function Li({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row gap-2">
      <Text className="text-sm leading-6 text-muted-foreground">•</Text>
      <RNText className="flex-1 text-sm leading-6 text-muted-foreground">{children}</RNText>
    </View>
  );
}

export function B({ children }: { children: React.ReactNode }) {
  return <RNText className="font-semibold text-foreground">{children}</RNText>;
}

export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <RNText
      className="text-foreground underline"
      onPress={() => {
        if (href.startsWith('/')) router.push(href as any);
        else Linking.openURL(href).catch(() => {});
      }}>
      {children}
    </RNText>
  );
}

/** Shared chrome for the public legal pages. Deliberately independent of auth state. */
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: insets.bottom + 32 }}>
      <View className="w-full max-w-3xl gap-4 self-center">
        <Text className="font-heading-bold text-3xl tracking-tight">{title}</Text>
        <View className="gap-4">{children}</View>
        <View className="mt-4 flex-row flex-wrap items-center gap-x-3 gap-y-2">
          <Pressable hitSlop={8} onPress={() => router.push('/')}>
            <Text className="text-sm text-muted-foreground">Home</Text>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => router.push('/privacy')}>
            <Text className="text-sm text-muted-foreground">Privacy</Text>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => router.push('/terms')}>
            <Text className="text-sm text-muted-foreground">Terms</Text>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => router.push('/login')}>
            <Text className="text-sm text-muted-foreground">Sign in</Text>
          </Pressable>
        </View>
        <RNText className="pt-2 text-xs text-muted-foreground">
          Last updated: October 1, 2026 ·{' '}
          <RNText className="underline" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}>
            Contact support
          </RNText>
        </RNText>
      </View>
    </ScrollView>
  );
}
