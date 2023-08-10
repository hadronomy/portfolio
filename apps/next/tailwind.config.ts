import type { Config } from 'tailwindcss';

import baseConfig from '@portofolio/tailwind-config';

export default {
  content: [
    ...baseConfig.content,
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [baseConfig],
} satisfies Config;
