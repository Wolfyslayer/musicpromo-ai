import * as React from 'react';
import { TextInput } from 'react-native';

import { cn } from '@/lib/utils';

export const Input = React.forwardRef<TextInput, React.ComponentProps<typeof TextInput>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <TextInput
      ref={ref}
      className={cn(
        'h-11 rounded-md border placeholder:text-muted-foreground border-input bg-background px-3 text-base text-foreground',
        props.editable === false && 'opacity-50',
        className
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<TextInput, React.ComponentProps<typeof TextInput>>(function Textarea(
  { className, ...props },
  ref
) {
  return (
    <TextInput
      ref={ref}
      multiline
      textAlignVertical="top"
      className={cn(
        'min-h-24 rounded-md border placeholder:text-muted-foreground border-input bg-background px-3 py-2 text-base text-foreground',
        className
      )}
      {...props}
    />
  );
});
