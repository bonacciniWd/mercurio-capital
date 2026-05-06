/** @type {import('tailwindcss').Config} */
// Paleta unificada Mercurio: VERMELHO · BRANCO · PRETO (padrão admin)
// Os tokens "navy" e "gold" foram preservados para evitar refactor em todas
// as classes; agora "navy" = tons de preto e "gold" = tons de vermelho.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Antigamente azul-marinho — agora preto
        navy: {
          50:  '#F5F5F5',
          100: '#E5E5E5',
          500: '#404040',
          700: '#171717',
          900: '#000000',
          DEFAULT: '#0F0F0F',
        },
        // Antigamente dourado — agora vermelho
        gold: {
          50:  '#FEE2E2',
          400: '#F87171',
          500: '#DC2626',
          600: '#B91C1C',
          700: '#991B1B',
          DEFAULT: '#DC2626',
        },
        silver: {
          50:  '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#0A0A0A',
        },
        success: '#16A34A',
        danger:  '#DC2626',
        warning: '#F59E0B',
      },
    },
  },
  plugins: [],
}
