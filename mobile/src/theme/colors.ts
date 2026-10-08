/** Brand tokens mirrored from web `src/index.css` (light + dark). */

export type AppColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  success: string;
  warning: string;
  chart1: string;
  chart2: string;
  chart3: string;
};

export const lightColors: AppColors = {
  background: "#F4F5F8",
  foreground: "#0F1320",
  card: "#FFFFFF",
  cardForeground: "#0F1320",
  primary: "#8B5CF6",
  primaryForeground: "#FFFFFF",
  secondary: "#EBEEF3",
  secondaryForeground: "#0F1320",
  muted: "#EBEEF3",
  mutedForeground: "#626B7A",
  accent: "#E11D8A",
  accentForeground: "#FFFFFF",
  destructive: "#DC2626",
  destructiveForeground: "#FAFAFA",
  border: "#D9DEE6",
  input: "#D9DEE6",
  ring: "#8B5CF6",
  success: "#16A34A",
  warning: "#D97706",
  chart1: "#8B5CF6",
  chart2: "#E11D8A",
  chart3: "#22D3EE",
};

export const darkColors: AppColors = {
  background: "#09090B",
  foreground: "#FAFAFA",
  card: "#141416",
  cardForeground: "#FAFAFA",
  primary: "#A78BFA",
  primaryForeground: "#FFFFFF",
  secondary: "#1C1C1F",
  secondaryForeground: "#FAFAFA",
  muted: "#1C1C1F",
  mutedForeground: "#8E8E96",
  accent: "#F472B6",
  accentForeground: "#FFFFFF",
  destructive: "#EF4444",
  destructiveForeground: "#FAFAFA",
  border: "#27272A",
  input: "#27272A",
  ring: "#A78BFA",
  success: "#22C55E",
  warning: "#F59E0B",
  chart1: "#A78BFA",
  chart2: "#F472B6",
  chart3: "#22D3EE",
};

export function resolveColors(scheme: "light" | "dark" | null | undefined): AppColors {
  return scheme === "dark" ? darkColors : lightColors;
}
