import fs from 'fs';
import path from 'path';
import { defineDocumentType, makeSource } from 'contentlayer/source-files';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

/** @type {import('contentlayer/source-files').ComputedFields} */
const computedFields = {
  slug: {
    type: 'string',
    resolve(doc) {
      return `/${doc._raw.flattenedPath}`;
    }
  },
  slugAsParams: {
    type: 'string',
    resolve(doc) {
      return doc._raw.flattenedPath.split('/').slice(1).join('/');
    }
  }
};

export const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: '**/*.mdx',
  contentType: 'mdx',
  fields: {
    title: {
      type: 'string',
      required: true
    },
    description: {
      type: 'string'
    },
    image: {
      type: 'string',
      required: true
    },
    date: {
      type: 'date',
      required: true
    },
    tags: {
      type: 'list',
      of: { type: 'string' },
      default: []
    },
    published: {
      type: 'boolean',
      default: false
    }
  },
  computedFields
}));

/** @type {import('rehype-pretty-code').Options} */
const prettyCodeOptions = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  theme: JSON.parse(
    fs.readFileSync(path.resolve('./assets/mocha.json'), 'utf-8')
  ),
  keepBackground: false,
  onVisitLine(node) {
    if (node.children.length === 0) {
      node.children = [{ type: 'text', value: ' ' }];
    }
  },
  onVisitHighlightedLine(node) {
    node.properties.className?.push('line--highlighted');
  }
};

export default makeSource({
  contentDirPath: 'src/blog',
  documentTypes: [Post],
  mdx: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [rehypePrettyCode, prettyCodeOptions]
      // [
      //   rehypeAutolinkHeadings,
      //   {
      //     properties: {
      //       className: ['subheading-anchor'],
      //       ariaLabel: 'Link to sections'
      //     }
      //   }
      // ]
    ]
  }
});
