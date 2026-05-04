import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        surface: {
          900: '#050507',
          800: '#0d0d12',
          700: '#13131a',
          600: '#1a1a24',
          500: '#22222e',
        },
        accent: {
          DEFAULT: '#6366f1',
          dim: '#4f51c8',
          glow: '#818cf8',
        },
      },
    },
  },
  plugins: [],
};

export default config;
