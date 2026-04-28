/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#E6ECF2',
          100: '#C2CFDD',
          500: '#1E4A7A',
          700: '#0A2B4E',
          900: '#061B33',
          DEFAULT: '#0A2B4E',
        },
        gold: {
          50: '#FAF3DD',
          400: '#E6C87A',
          500: '#D4AF37',
          600: '#B8962B',
          DEFAULT: '#D4AF37',
        },
        silver: {
          50: '#F8F9FA',
          100: '#F1F3F5',
          200: '#DEE2E6',
          300: '#CED4DA',
          400: '#9CA3AF',
          500: '#6C757D',
          600: '#495057',
          700: '#343A40',
          800: '#212529',
          900: '#0F1419',
        },
        success: '#2C9A4C',
        danger: '#D9534F',
        warning: '#F0AD4E',
      },
    },
  },
  plugins: [],
}
