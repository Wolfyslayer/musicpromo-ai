import { Check } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export function Checkbox({ checked, onCheckedChange, className }: { checked: boolean; onCheckedChange?: (v: boolean) => void; className?: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={8}
      onPress={() => onCheckedChange?.(!checked)}
      className={cn('size-5 items-center justify-center rounded border border-primary', checked && 'bg-primary', className)}>
      {checked ? <Icon as={Check} size={14} className="text-primary-foreground" /> : null}
    </Pressable>
  );
}
