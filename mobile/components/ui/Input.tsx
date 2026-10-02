import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  containerClassName?: string;
};

export function Input({ label, error, containerClassName, className, ...props }: Props) {
  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label ? <Text className="text-sm font-medium text-foreground">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#64748b"
        className={cn(
          'min-h-12 rounded-xl border border-border bg-card px-4 text-base text-foreground',
          error && 'border-destructive',
          className,
        )}
        {...props}
      />
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
    </View>
  );
}
