/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: "var(--color-card)",
        muted: "var(--color-muted)",
        "muted-foreground": "var(--color-muted-foreground)",
        primary: "var(--color-primary)",
        accent: "var(--color-accent)",
        border: "var(--color-border)",
        destructive: "var(--color-destructive)",
      },
      fontFamily: {
        sans: ["Inter_400Regular"],
        heading: ["SpaceGrotesk_700Bold"],
      },
    },
  },
  plugins: [],
};
