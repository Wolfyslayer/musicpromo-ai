import { useColorScheme } from 'nativewind';

/** Hex mirrors of the CSS variables in global.css, for APIs that cannot take className (icons, charts, native props). */
export const palette = {
  light: {
    background: '#f8fafc',
    foreground: '#0f1729',
    card: '#ffffff',
    primary: '#a164f7',
    primaryForeground: '#ffffff',
    secondary: '#f1f5f9',
    muted: '#f1f5f9',
    mutedForeground: '#65758b',
    accent: '#f04ca9',
    destructive: '#db2424',
    border: '#e1e7ef',
    chart1: '#a164f7',
    chart2: '#f04ca9',
    chart3: '#25d1f4',
    chart4: '#f5c13d',
    chart5: '#ec5151',
  },
  dark: {
    background: '#0b0b0f',
    foreground: '#fafafa',
    card: '#131217',
    primary: '#a164f7',
    primaryForeground: '#ffffff',
    secondary: '#1f1e24',
    muted: '#1f1e24',
    mutedForeground: '#9898a4',
    accent: '#f04ca9',
    destructive: '#e03e3e',
    border: '#26252d',
    chart1: '#a164f7',
    chart2: '#f04ca9',
    chart3: '#25d1f4',
    chart4: '#f5c13d',
    chart5: '#ec5151',
  },
} as const;

export type Palette = Record<keyof typeof palette.light, string>;

export function useThemeColors(): Palette {
  const { colorScheme } = useColorScheme();
  return palette[colorScheme === 'dark' ? 'dark' : 'light'];
}
