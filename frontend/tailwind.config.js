/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        serif: ['DM Serif Display', 'serif'],
      },
      colors: {
        bg: '#0f1117',
        surface: '#181b24',
        surface2: '#1f2332',
        border: '#2a2f42',
        accent: '#c9a96e',
        accent2: '#e8c98a',
      },
    },
  },
  plugins: [],
}
