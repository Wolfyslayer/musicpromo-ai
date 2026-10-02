import type { LucideIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

import { cn } from '@/lib/utils';

type IconProps = {
  as: LucideIcon;
  className?: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
};

function IconImpl({ as: IconComponent, ...props }: IconProps) {
  return <IconComponent {...props} />;
}

cssInterop(IconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: { height: 'size', width: 'size', color: 'color' },
  },
});

/** Lucide icon styled through className, e.g. `<Icon as={Plus} className="size-4 text-primary" />`. */
export function Icon({ className, size = 16, ...props }: IconProps) {
  return <IconImpl className={cn('text-foreground', className)} size={size} {...props} />;
}
