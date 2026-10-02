import { Platform, View } from 'react-native';

import CopyButton from '@/components/CopyButton';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export default function PromoTextCard({ label, text, className = '' }: { label: string; text?: string | null; className?: string }) {
  if (!text) return null;
  const isHashtags = label === 'HASHTAGS';
  return (
    <View className={cn('rounded-xl border border-border/50 bg-muted/30 p-3', className)}>
      <View className="mb-1.5 flex-row items-center justify-between gap-2">
        <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Text>
        <CopyButton text={text} label="Copy" />
      </View>
      <Text selectable className={cn('text-sm', isHashtags && 'text-xs text-primary')} style={isHashtags ? { fontFamily: MONO } : undefined}>
        {text}
      </Text>
    </View>
  );
}
