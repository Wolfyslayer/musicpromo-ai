import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';

/** Resolve a `returnTo` param to an in-app absolute path (single leading slash, no backslash), else "/". */
export function safeReturnTo(raw?: string | string[] | null): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  if (/[\u0000-\u001f]/.test(value)) return '/';
  return value;
}

export function withReturnTo(path: string, returnTo: string) {
  return returnTo !== '/' ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path;
}

export function AuthField({ label, icon, extra, children }: { label: string; icon: LucideIcon; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Label className="mb-0">{label}</Label>
        {extra}
      </View>
      <View className="justify-center">
        <View pointerEvents="none" className="absolute left-3 z-10">
          <Icon as={icon} size={16} className="text-muted-foreground" />
        </View>
        {children}
      </View>
    </View>
  );
}

export function AuthError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View className="mb-4 rounded-lg bg-destructive/10 p-3">
      <Text className="text-sm text-destructive">{message}</Text>
    </View>
  );
}

type AuthLayoutProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export default function AuthLayout({ icon, title, subtitle, footer, children }: AuthLayoutProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <View className="w-full max-w-md self-center">
          <View className="mb-8 items-center">
            <View className="mb-4 size-14 items-center justify-center rounded-2xl bg-primary">
              <Icon as={icon} size={28} className="text-primary-foreground" />
            </View>
            <Text className="text-center font-heading-bold text-3xl tracking-tight">{title}</Text>
            {subtitle ? <Text className="mt-2 text-center text-muted-foreground">{subtitle}</Text> : null}
          </View>

          <View className="rounded-2xl border border-border bg-card p-6">{children}</View>

          {footer ? <View className="mt-6 items-center">{footer}</View> : null}

          <View className="mt-4 flex-row items-center justify-center gap-2">
            <Pressable hitSlop={8} onPress={() => router.push('/privacy')}>
              <Text className="text-xs text-muted-foreground">Privacy</Text>
            </Pressable>
            <Text className="text-xs text-muted-foreground">·</Text>
            <Pressable hitSlop={8} onPress={() => router.push('/terms')}>
              <Text className="text-xs text-muted-foreground">Terms</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
