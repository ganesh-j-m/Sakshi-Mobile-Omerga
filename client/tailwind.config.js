/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' }, screens: { '2xl': '1320px' } },
    extend: {
      fontFamily: { sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { 50: '#EEF1FB', 100: '#D9DFF5', 200: '#AEB9E6', 400: '#5A6BB0', 600: '#1E2A5E', 700: '#141D45', 800: '#0D1433', 900: '#0A0F2C', 950: '#060920' },
        electric: { 50: '#EEF4FF', 100: '#DCE7FF', 200: '#B5CCFF', 300: '#82A8FF', 400: '#4D7CFF', 500: '#2563FF', 600: '#1A4FE0', 700: '#1640B5', 800: '#163A8F', 900: '#172F6B' },
        violet: { 50: '#F5F2FF', 100: '#EDE7FF', 200: '#D9CCFF', 300: '#BBA3FF', 400: '#9A70FF', 500: '#7C3AED', 600: '#6D28D9', 700: '#5B21B6', 800: '#4C1D95', 900: '#3B1574' },
        flame: { 50: '#FFF5ED', 100: '#FFE8D4', 200: '#FFCDA8', 300: '#FFAA70', 400: '#FF8A3D', 500: '#FF7A18', 600: '#EA5E05', 700: '#C24607', 800: '#9A380E', 900: '#7C300F' },
      },
      boxShadow: {
        glow: '0 10px 40px -10px rgba(37, 99, 255, 0.55)',
        'glow-violet': '0 10px 40px -10px rgba(124, 58, 237, 0.55)',
        'glow-flame': '0 10px 40px -10px rgba(255, 122, 24, 0.6)',
        card: '0 1px 2px rgba(10,15,44,0.04), 0 8px 24px -12px rgba(10,15,44,0.12)',
        'card-hover': '0 2px 4px rgba(10,15,44,0.06), 0 24px 48px -16px rgba(37,99,255,0.28)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2563FF 0%, #7C3AED 55%, #FF7A18 100%)',
        'hero-gradient': 'radial-gradient(1200px 600px at 10% 10%, rgba(37,99,255,0.35), transparent 60%), radial-gradient(900px 500px at 90% 20%, rgba(124,58,237,0.35), transparent 60%), radial-gradient(700px 400px at 70% 100%, rgba(255,122,24,0.25), transparent 60%)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0) rotate(var(--r,0deg))' }, '50%': { transform: 'translateY(-14px) rotate(var(--r,0deg))' } },
        'gradient-x': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'gradient-x': 'gradient-x 10s ease infinite',
        marquee: 'marquee 30s linear infinite',
      },
    },
  },
  plugins: [],
};
