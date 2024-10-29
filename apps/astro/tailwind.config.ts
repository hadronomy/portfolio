import type { Config } from 'tailwindcss';

import baseConfig from '@portfolio/tailwind-config';
import { createPreset } from 'fumadocs-ui/tailwind-plugin';

export default {
  content: [
    ...baseConfig.content,
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    './node_modules/fumadocs-ui/dist/**/*.js',
  ],
  presets: [baseConfig, createPreset()],
} satisfies Config;
