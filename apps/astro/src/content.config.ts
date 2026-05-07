import { defineCollection } from 'astro:content';

import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './blog', pattern: '*.mdx' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image(),
      state: z.enum(['published', 'draft']).default('draft'),
    }),
});

export const collections = { blog };
