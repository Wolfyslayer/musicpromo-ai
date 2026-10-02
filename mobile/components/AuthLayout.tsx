import { Link } from 'expo-router';
import { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthLayout({ icon: Icon, title, subtitle, footer, children }: Props) {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="grow justify-center px-4 py-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="mx-auto w-full max-w-md">
        <View className="mb-10 items-center">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Icon color="#fff" size={28} />
          </View>
          <Text className="text-center text-3xl font-bold text-foreground">{title}</Text>
          {subtitle ? (
            <Text className="mt-2 text-center text-base text-muted-foreground">{subtitle}</Text>
          ) : null}
        </View>
        <View className="rounded-2xl border border-border bg-card p-6">{children}</View>
        {footer ? <View className="mt-6">{footer}</View> : null}
        <View className="mt-4 flex-row justify-center gap-2">
          <Link href="/privacy">
            <Text className="text-xs text-muted-foreground">Privacy</Text>
          </Link>
          <Text className="text-xs text-muted-foreground">·</Text>
          <Link href="/terms">
            <Text className="text-xs text-muted-foreground">Terms</Text>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
