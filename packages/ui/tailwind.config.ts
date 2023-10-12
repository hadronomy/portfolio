import baseConfig from '@portfolio/tailwind-config';
import type { Config } from 'tailwindcss';

export default {
  content: baseConfig.content,
  presets: [baseConfig],
} satisfies Config;
