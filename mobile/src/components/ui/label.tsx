import * as React from 'react';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn('mb-1.5 text-sm font-medium', className)} {...props} />;
}
