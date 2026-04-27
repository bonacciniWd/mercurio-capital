/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Mercurio palette
        navy: {
          DEFAULT: '#0A2B4E',
          50: '#E8EEF5',
          100: '#C5D3E3',
          200: '#8FAACB',
          300: '#5A80B2',
          400: '#2C5A88',
          500: '#0A2B4E',
          600: '#082240',
          700: '#061A30',
          800: '#041222',
          900: '#020A14',
        },
        silver: {
          DEFAULT: '#9CA3AF',
          50: '#F8F9FA',
          100: '#F1F3F5',
          200: '#DEE2E6',
          300: '#CED4DA',
          400: '#ADB5BD',
          500: '#9CA3AF',
          600: '#6C757D',
          700: '#495057',
          800: '#343A40',
          900: '#212529',
        },
        gold: {
          DEFAULT: '#D4AF37',
          50: '#FAF4DD',
          100: '#F4E7B4',
          200: '#EAD181',
          300: '#E0BC4F',
          400: '#D4AF37',
          500: '#B8962C',
          600: '#967826',
          700: '#735C1F',
          800: '#514118',
          900: '#2E2510',
        },
        chart: {
          blue: '#2C6B9E',
          silver: '#A9B7C6',
          gold: '#E6C87A',
        },
        success: '#2C9A4C',
        danger: '#D9534F',
        warning: '#F0AD4E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [],
}
