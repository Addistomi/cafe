import type { Config } from 'tailwindcss';

// All brand tokens live here so the owner can approve a new palette in one place.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coffee: { DEFAULT: '#70452F', dark: '#4F2F20', soft: '#F1E4D8' },
        ink: '#2D211B',
        accent: { DEFAULT: '#D87936', soft: '#FBE7D3' },
        cream: '#FBF6EF',
        surface: '#FFFFFF',
        line: '#E3D8CE',
        muted: '#74675E',
        success: { DEFAULT: '#28734D', soft: '#DDF0E5' },
        warning: { DEFAULT: '#A66A18', soft: '#F8EBCF' },
        danger: { DEFAULT: '#A63A32', soft: '#F6DEDB' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '14px', field: '10px' },
    },
  },
  plugins: [],
};
export default config;
