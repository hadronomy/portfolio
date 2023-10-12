import baseConfig from '@portfolio/tailwind-config';
import type { Config } from 'tailwindcss';

export default {
  content: [
    ...baseConfig.content,
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [baseConfig],
} satisfies Config;
