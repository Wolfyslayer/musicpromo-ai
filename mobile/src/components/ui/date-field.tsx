import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { parseDateOnly, toDateOnlyISO } from '@/services/format';
import { cn } from '@/lib/utils';

/** Replaces `<input type="date">`: value and onChange use `YYYY-MM-DD` strings. */
export function DateField({ value, onChange, placeholder = 'Select date', className }: { value?: string | null; onChange: (iso: string) => void; placeholder?: string; className?: string }) {
  const [show, setShow] = useState(false);
  const date = parseDateOnly(value || '') || new Date();
  return (
    <>
      <Pressable onPress={() => setShow(true)} className={cn('h-11 flex-row items-center justify-between rounded-md border border-input bg-background px-3', className)}>
        <Text className={cn('text-base', !value && 'text-muted-foreground')}>{value ? format(date, 'MMM d, yyyy') : placeholder}</Text>
        <Icon as={Calendar} size={16} className="text-muted-foreground" />
      </Pressable>
      {show ? (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, selected) => {
            if (Platform.OS !== 'ios') setShow(false);
            if (selected) onChange(toDateOnlyISO(selected) as string);
          }}
        />
      ) : null}
    </>
  );
}
