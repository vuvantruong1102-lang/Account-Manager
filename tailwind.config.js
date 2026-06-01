/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '24': 'repeat(24, minmax(0, 1fr))',
        '28': 'repeat(28, minmax(0, 1fr))',
      },
      colors: {
        brand: {
          DEFAULT: '#dc143b',
          50: '#fef2f4',
          100: '#fde6e9',
          600: '#dc143b',
          700: '#b8102f',
        },
        ink: {
          DEFAULT: '#1f2430',
          soft: '#5b6170',
          faint: '#9aa0ad',
        },
        paper: {
          DEFAULT: '#f7f7f5',
          card: '#ffffff',
          line: '#ececea',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(31,36,48,0.04), 0 4px 16px rgba(31,36,48,0.04)',
        float: '0 8px 30px rgba(31,36,48,0.08)',
      },
    },
  },
  plugins: [],
}
