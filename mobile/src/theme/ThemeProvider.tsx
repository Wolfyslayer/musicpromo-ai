import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { AppColors, resolveColors } from "./colors";

type ThemeValue = {
  colors: AppColors;
  scheme: "light" | "dark";
};

const ThemeContext = createContext<ThemeValue>({
  colors: resolveColors("light"),
  scheme: "light",
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const scheme: "light" | "dark" = colorScheme === "dark" ? "dark" : "light";
  const value = useMemo(
    () => ({ colors: resolveColors(scheme), scheme }),
    [scheme]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
