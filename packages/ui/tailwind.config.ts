import type { Config } from 'tailwindcss';

import baseConfig from '@portofolio/tailwind-config';

export default {
  content: baseConfig.content,
  presets: [baseConfig],
} satisfies Config;
