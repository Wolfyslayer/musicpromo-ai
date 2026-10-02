import { Switch as RNSwitch } from 'react-native';

import { useThemeColors } from '@/lib/theme';

export function Switch({ checked, onCheckedChange, disabled }: { checked: boolean; onCheckedChange?: (v: boolean) => void; disabled?: boolean }) {
  const colors = useThemeColors();
  return (
    <RNSwitch
      value={checked}
      onValueChange={onCheckedChange}
      disabled={disabled}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor="#ffffff"
    />
  );
}
