import * as React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type ScreenProps = {
  children: React.ReactNode;
  /** Disable the ScrollView for screens that manage their own list/scroll. */
  scroll?: boolean;
  onRefresh?: () => Promise<unknown> | void;
  className?: string;
  contentClassName?: string;
  /** Add bottom padding for the tab bar (tab screens) instead of the home-indicator inset. */
  tabScreen?: boolean;
};

/** Standard page container: safe-area aware, keyboard aware, pull-to-refresh. Replaces the web `<Layout>` outlet wrapper. */
export function Screen({ children, scroll = true, onRefresh, className, contentClassName, tabScreen }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);
  const bottom = tabScreen ? 16 : insets.bottom + 16;

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className={cn('flex-1 bg-background', className)}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} /> : undefined}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: bottom }}>
          <View className={cn('gap-6', contentClassName)}>{children}</View>
        </ScrollView>
      ) : (
        <View className={cn('flex-1', contentClassName)}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={cn('mb-3 font-heading text-sm uppercase tracking-wider text-muted-foreground', className)}>{children}</Text>;
}
