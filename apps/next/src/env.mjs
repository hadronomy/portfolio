import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    ANALYTICS_ID: z.string()
  },
  client: {},
  experimental__runtimeEnv: {}
});
