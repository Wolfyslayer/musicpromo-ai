import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

type Props = TextInputProps & { label?: string };

export function Textarea({ label, className, ...props }: Props) {
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-sm font-medium text-foreground">{label}</Text> : null}
      <TextInput
        multiline
        textAlignVertical="top"
        placeholderTextColor="#64748b"
        className={cn('min-h-[100px] rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground', className)}
        {...props}
      />
    </View>
  );
}
