import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f8fb',
          100: '#eef1f6',
          200: '#dbe0ea',
          300: '#a7afc0',
          500: '#64708a',
          700: '#2b3448',
          900: '#0b1020',
        },
        accent: {
          50: '#eaf2ff',
          100: '#d2e2ff',
          500: '#3b6fd1',
          600: '#2a57b0',
          700: '#1f4289',
        },
        brand: {
          500: '#1e3a8a',
          600: '#172f6d',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f5f7fb',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.04)',
        'card-hover': '0 4px 12px rgba(16, 24, 40, 0.06), 0 2px 4px rgba(16, 24, 40, 0.04)',
      },
      borderRadius: {
        pill: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
