import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export default function CopyButton({ text, label, className = '' }: { text?: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text || '');
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  };
  return (
    <Pressable onPress={copy} className={cn('flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5', done ? 'bg-chart-2/15' : 'bg-muted', className)}>
      <Icon as={done ? Check : Copy} size={14} className={done ? 'text-chart-2' : 'text-muted-foreground'} />
      <Text className={cn('text-xs font-medium', done ? 'text-chart-2' : 'text-muted-foreground')}>{done ? 'Copied' : label || 'Copy'}</Text>
    </Pressable>
  );
}
