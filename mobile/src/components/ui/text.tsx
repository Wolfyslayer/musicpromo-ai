import * as React from 'react';
import { Text as RNText } from 'react-native';

import { cn } from '@/lib/utils';

export const Text = React.forwardRef<RNText, React.ComponentProps<typeof RNText>>(function Text(
  { className, ...props },
  ref
) {
  return <RNText ref={ref} className={cn('text-base text-foreground', className)} {...props} />;
});
