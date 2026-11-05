import defaultTheme from 'tailwindcss/defaultTheme';

// Bharat Yaatri admin theme: the Zaishree system (theme.md) with its palette swapped for the
// Partner logo — navy for ink and chrome, orange as the single accent.
//
//   theme.md        here
//   rose         →  brand        #F26B21  logo orange
//   rose-deep    →  brand-deep   #D3560F
//   rose-soft    →  brand-soft   #F8B88E
//   charcoal     →  ink          #0E2A47  logo navy (all text)
//   ivory        →  mist         #F4F6F9  secondary surface
//   beige        →  line         #C5CED9  hairlines
//   (new)           navy         #0D2C4B  sidebar + auth panel
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        mist: '#F4F6F9',
        brand: { DEFAULT: '#F26B21', deep: '#D3560F', soft: '#F8B88E' },
        ink: '#0E2A47',
        line: '#C5CED9',
        navy: { DEFAULT: '#0D2C4B', light: '#163B61', dark: '#0A2239' },
      },
      // System default fonts (no web fonts are loaded). `font-display` is kept as a class name for
      // headings and big numbers, but it is the same default sans stack — weight comes from CSS.
      fontFamily: {
        display: defaultTheme.fontFamily.sans,
      },
      fontSize: {
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.14em' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(14,42,71,0.04), 0 8px 24px -16px rgba(14,42,71,0.14)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .28s ease-out both' },
    },
  },
  plugins: [],
};
