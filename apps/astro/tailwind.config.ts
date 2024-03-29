import type { Config } from 'tailwindcss';

import baseConfig from '@portfolio/tailwind-config';

export default {
  content: [
    ...baseConfig.content,
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [baseConfig],
} satisfies Config;
