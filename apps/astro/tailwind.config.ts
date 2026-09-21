import baseConfig from '@portfolio/tailwind-config';
import type { Config } from 'tailwindcss';

export default {
  content: [
    ...baseConfig.content,
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [baseConfig],
  theme: {
    extend: {
      // Core's three canvas widths. They are the only breakpoints the design
      // defines, so a section verified at these widths is verified everywhere.
      screens: {
        phone: '390px',
        tablet: '810px',
        desktop: '1200px',
      },
      colors: {
        surface: 'hsl(var(--surface))',
        inset: 'hsl(var(--inset))',
        overlay: 'hsl(var(--overlay))',
        button: {
          DEFAULT: 'hsl(var(--button))',
          hover: 'hsl(var(--button-hover))',
        },
        'nav-item': 'hsl(var(--nav-item))',
        cursor: 'hsl(var(--cursor))',
        shortcut: {
          DEFAULT: 'hsl(var(--shortcut))',
          shadow: 'hsl(var(--shortcut-shadow))',
        },
      },
      borderColor: {
        subtle: 'hsl(var(--border-subtle))',
        'light-only': 'hsl(var(--border-light-only))',
        'dark-only': 'hsl(var(--border-dark-only))',
      },
      borderRadius: {
        pill: 'var(--radius-pill)',
      },
      maxWidth: {
        content: 'var(--content-width)',
        measure: 'var(--measure)',
      },
    },
  },
} satisfies Config;
