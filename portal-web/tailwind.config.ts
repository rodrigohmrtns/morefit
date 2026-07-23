import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#C6F14B', fg: '#0F1110', dark: '#26301A', tint: '#EAF6D3' },
        surface: { DEFAULT: '#F5F6F4', soft: '#FFFFFF', strong: '#0E100F', onStrong: '#F5F6F4', tertiary: '#EDEFEC' },
        ink: { DEFAULT: '#0F1110', muted: '#83877F', soft: '#4E524F' },
        state: { success: '#4C8A5B', warning: '#F4A261', error: '#E05A5F', info: '#3B82A0' },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { pill: '999px' },
    },
  },
  plugins: [],
};

export default config;
