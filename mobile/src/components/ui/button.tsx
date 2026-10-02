import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const buttonVariants = cva('flex-row items-center justify-center gap-2 rounded-md active:opacity-80', {
  variants: {
    variant: {
      default: 'bg-primary',
      destructive: 'bg-destructive',
      outline: 'border border-input bg-transparent',
      secondary: 'bg-secondary',
      ghost: 'bg-transparent',
      link: 'bg-transparent',
    },
    size: {
      default: 'h-11 px-4',
      sm: 'h-9 px-3',
      lg: 'h-12 px-8',
      icon: 'h-11 w-11',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

const textVariants = cva('text-sm font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
      link: 'text-primary underline',
    },
    size: { default: '', sm: 'text-xs', lg: 'text-base', icon: '' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    textClassName?: string;
  };

/** String children are wrapped in Text automatically; pass elements (icons + Text) for richer content. */
export function Button({ className, textClassName, variant, size, loading, disabled, children, ...props }: ButtonProps) {
  const content = React.Children.map(children as React.ReactNode, (child) =>
    typeof child === 'string' || typeof child === 'number' ? (
      <Text className={cn(textVariants({ variant, size }), textClassName)}>{child}</Text>
    ) : (
      child
    )
  );
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), (disabled || loading) && 'opacity-50', className)}
      {...props}>
      {loading ? <ActivityIndicator size="small" color={variant === 'default' ? '#fff' : undefined} /> : null}
      {content}
    </Pressable>
  );
}

export { buttonVariants, textVariants };
