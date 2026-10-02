import { X } from 'lucide-react-native';
import * as React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** "center" renders an alert-style card, "sheet" slides up from the bottom. */
  variant?: 'center' | 'sheet';
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

/** Replaces Radix Dialog / Sheet / Drawer with a native Modal. */
export function Dialog({ open, onOpenChange, title, description, variant = 'center', children, footer, className }: DialogProps) {
  const insets = useSafeAreaInsets();
  const isSheet = variant === 'sheet';
  return (
    <Modal visible={open} transparent animationType={isSheet ? 'slide' : 'fade'} onRequestClose={() => onOpenChange(false)} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Pressable className={cn('flex-1 bg-black/60', isSheet ? 'justify-end' : 'justify-center px-5')} onPress={() => onOpenChange(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={isSheet ? { paddingBottom: Math.max(insets.bottom, 12), maxHeight: '88%' } : { maxHeight: '88%' }}
            className={cn('border border-border bg-popover p-5', isSheet ? 'rounded-t-3xl' : 'rounded-2xl', className)}>
            <View className="mb-3 flex-row items-start justify-between gap-3">
              <View className="flex-1">
                {title ? <Text className="font-heading text-lg">{title}</Text> : null}
                {description ? <Text className="mt-1 text-sm text-muted-foreground">{description}</Text> : null}
              </View>
              <Pressable hitSlop={10} onPress={() => onOpenChange(false)} accessibilityLabel="Close">
                <Icon as={X} size={20} className="text-muted-foreground" />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            {footer ? <View className="mt-4 flex-row justify-end gap-2">{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
