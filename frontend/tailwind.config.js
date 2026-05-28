/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        pitch: {
          950: '#040A0F',
          900: '#070F17',
          800: '#0D1B26',
          700: '#132433',
        },
        accent: {
          green: '#00FF87',
          dim: '#00CC6A',
        },
        data: '#E8F4FD',
      },
    },
  },
  plugins: [],
}
