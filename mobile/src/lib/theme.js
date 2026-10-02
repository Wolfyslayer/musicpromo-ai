import { useColorScheme } from "nativewind";

/** Hex mirrors of the HSL tokens in global.css, for APIs that can't take a className (icons, charts, navigation). */
export const COLORS = {
  light: {
    background: "#F8FAFC",
    foreground: "#0F1729",
    card: "#FFFFFF",
    popover: "#FFFFFF",
    primary: "#A164F7",
    primaryForeground: "#FFFFFF",
    secondary: "#F1F5F9",
    muted: "#F1F5F9",
    mutedForeground: "#65758B",
    accent: "#F04CA9",
    destructive: "#DB2424",
    border: "#E1E7EF",
    chart1: "#A164F7",
    chart2: "#F04CA9",
    chart3: "#25D1F4",
    chart4: "#F5C13D",
    chart5: "#EC5151",
  },
  dark: {
    background: "#0B0B0F",
    foreground: "#FAFAFA",
    card: "#131217",
    popover: "#15141A",
    primary: "#A164F7",
    primaryForeground: "#FFFFFF",
    secondary: "#1F1E24",
    muted: "#1F1E24",
    mutedForeground: "#9898A4",
    accent: "#F04CA9",
    destructive: "#E03E3E",
    border: "#26252D",
    chart1: "#A164F7",
    chart2: "#F04CA9",
    chart3: "#25D1F4",
    chart4: "#F5C13D",
    chart5: "#EC5151",
  },
};

export const BRAND_GRADIENT = ["#A164F7", "#F04CA9"];

export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  return COLORS[colorScheme === "dark" ? "dark" : "light"];
}
