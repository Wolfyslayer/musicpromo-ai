import { Pressable, Text, type PressableProps } from 'react-native';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'outline' | 'ghost' | 'destructive';

type Props = PressableProps & {
  variant?: Variant;
  label: string;
  className?: string;
  textClassName?: string;
};

const variants: Record<Variant, { container: string; text: string }> = {
  default: { container: 'bg-primary', text: 'text-primary-foreground' },
  outline: { container: 'border border-border bg-card', text: 'text-foreground' },
  ghost: { container: 'bg-transparent', text: 'text-foreground' },
  destructive: { container: 'bg-destructive', text: 'text-white' },
};

export function Button({
  variant = 'default',
  label,
  className,
  textClassName,
  disabled,
  ...props
}: Props) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      className={cn(
        'min-h-12 items-center justify-center rounded-xl px-4 opacity-100 active:opacity-80',
        v.container,
        disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      <Text className={cn('text-sm font-semibold', v.text, textClassName)}>{label}</Text>
    </Pressable>
  );
}
