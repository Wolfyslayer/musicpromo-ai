import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type SelectOption = { value: string; label: string };

/** Replaces Radix Select with a trigger that opens a bottom-sheet list. */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  title,
  className,
  disabled,
}: {
  value?: string | null;
  onValueChange: (value: string) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const normalized: SelectOption[] = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const selected = normalized.find((o) => o.value === value);
  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn('h-11 flex-row items-center justify-between rounded-md border border-input bg-background px-3', disabled && 'opacity-50', className)}>
        <Text className={cn('flex-1 text-base', !selected && 'text-muted-foreground')} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon as={ChevronDown} size={16} className="text-muted-foreground" />
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen} variant="sheet" title={title ?? placeholder}>
        <View className="pb-2">
          {normalized.map((o) => (
            <Pressable
              key={o.value}
              onPress={() => {
                onValueChange(o.value);
                setOpen(false);
              }}
              className="min-h-12 flex-row items-center justify-between border-b border-border/50 px-1">
              <Text className={cn('text-base', o.value === value && 'font-semibold text-primary')}>{o.label}</Text>
              {o.value === value ? <Icon as={Check} size={18} className="text-primary" /> : null}
            </Pressable>
          ))}
        </View>
      </Dialog>
    </>
  );
}
