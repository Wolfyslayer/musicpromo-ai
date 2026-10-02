/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: 'hsl(210 40% 98%)',
        foreground: 'hsl(222 47% 11%)',
        card: 'hsl(0 0% 100%)',
        'card-foreground': 'hsl(222 47% 11%)',
        primary: 'hsl(265 90% 68%)',
        'primary-foreground': 'hsl(0 0% 100%)',
        secondary: 'hsl(210 40% 96%)',
        muted: 'hsl(210 40% 96%)',
        'muted-foreground': 'hsl(215 16% 47%)',
        accent: 'hsl(326 85% 62%)',
        destructive: 'hsl(0 72% 50%)',
        border: 'hsl(214 32% 91%)',
      },
      fontFamily: {
        heading: ['System'],
        body: ['System'],
      },
    },
  },
  plugins: [],
};
