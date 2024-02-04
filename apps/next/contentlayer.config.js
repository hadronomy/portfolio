import rehypeShiki from '@shikijs/rehype';
import { defineDocumentType, makeSource } from 'contentlayer/source-files';
import { transformerTwoslash } from 'fumadocs-twoslash';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import rehypeSlug from 'rehype-slug';
import remarkGemoji from 'remark-gemoji';
import remarkGfm from 'remark-gfm';

/** @type {import('contentlayer/source-files').ComputedFields} */
const computedFields = {
  slug: {
    type: 'string',
    resolve(doc) {
      return `/${doc._raw.flattenedPath}`;
    },
  },
  slugAsParams: {
    type: 'string',
    resolve(doc) {
      return doc._raw.flattenedPath.split('/').slice(1).join('/');
    },
  },
};

export const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: '**/*.mdx',
  contentType: 'mdx',
  fields: {
    title: {
      type: 'string',
      required: true,
    },
    description: {
      type: 'string',
    },
    image: {
      type: 'string',
      required: true,
    },
    date: {
      type: 'date',
      required: true,
    },
    tags: {
      type: 'list',
      of: { type: 'string' },
      default: [],
    },
    published: {
      type: 'boolean',
      default: false,
    },
  },
  computedFields,
}));

export default makeSource({
  contentDirPath: 'src/blog',
  documentTypes: [Post],
  mdx: {
    remarkPlugins: [remarkGfm, remarkGemoji],
    rehypePlugins: [
      rehypeSlug,
      [
        // @ts-ignore
        rehypeShiki,
        /** @type {import('@shikijs/rehype').RehypeShikiOptions} */
        {
          themes: {
            light: 'catppuccin-latte',
            dark: 'catppuccin-mocha',
          },
          transformers: [transformerTwoslash()],
        },
      ],
      // [rehypePrettyCode, prettyCodeOptions],
      rehypeAccessibleEmojis,
      // [
      //   rehypeAutolinkHeadings,
      //   {
      //     properties: {
      //       className: ['subheading-anchor'],
      //       ariaLabel: 'Link to sections'
      //     }
      //   }
      // ]
    ],
  },
});
