import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.mdx',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // MoreFit brand
        brand: {
          DEFAULT: '#C6F14B', // lime
          fg: '#0F1110',
          dark: '#26301A',
          tint: '#EAF6D3',
        },
        surface: {
          DEFAULT: '#F5F6F4',
          soft: '#FFFFFF',
          strong: '#0E100F',
          onStrong: '#F5F6F4',
        },
        ink: {
          DEFAULT: '#0F1110',
          muted: '#83877F',
          soft: '#4E524F',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        pill: '999px',
      },
      spacing: {
        18: '4.5rem',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.6s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
