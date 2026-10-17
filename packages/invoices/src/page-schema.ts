import { getSchema, mergeAttributes, Node } from '@tiptap/core';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';
import { linkable } from '#page-links';

// What a quote's pages may hold, as one Tiptap extension list. The editor,
// the server's validation, the Markdown an agent reads and writes, and the
// PDF renderer all build on this list, so they agree on every node. Add a
// node here and it needs a PDF mapping in page-render.tsx and a Markdown
// form, or the renderer and the agent tools refuse documents that use it.

/** A forced page break. Markdown writes it as `::page-break` on its own line. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-page-break': '' }),
  ],
  markdownTokenizer: {
    name: 'pageBreak',
    level: 'block',
    start: (src) => src.search(/^::page-break[ \t]*$/m),
    tokenize: (src) => {
      const match = /^::page-break[ \t]*(?:\n|$)/.exec(src);
      return match ? { type: 'pageBreak', raw: match[0] } : undefined;
    },
  },
  parseMarkdown: (_token, helpers) => helpers.createNode('pageBreak'),
  renderMarkdown: () => '::page-break',
});

/**
 * A clause from the library, by id and version. It prints the library's
 * words for that version in the document's language, so a block cannot
 * drift from the text its source line vouches for. Markdown writes it as
 * `::clause[late-payment@1]` on its own line.
 */
export const ClauseBlock = Node.create({
  name: 'clause',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({
    id: { default: '' },
    version: { default: 1 },
  }),
  parseHTML: () => [
    {
      tag: 'div[data-clause]',
      getAttrs: (element) => ({
        id: element.getAttribute('data-clause') ?? '',
        version: Number(element.getAttribute('data-version') ?? 1),
      }),
    },
  ],
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, {
      'data-clause': node.attrs.id,
      'data-version': String(node.attrs.version),
    }),
  ],
  markdownTokenizer: {
    name: 'clause',
    level: 'block',
    start: (src) => src.search(/^::clause\[/m),
    tokenize: (src) => {
      const match = /^::clause\[([a-z0-9-]+)(?:@(\d+))?\][ \t]*(?:\n|$)/.exec(
        src,
      );
      if (!match) return undefined;
      return {
        type: 'clause',
        raw: match[0],
        id: match[1],
        version: Number(match[2] ?? 1),
      };
    },
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode('clause', { id: token.id, version: token.version }),
  renderMarkdown: (node) =>
    `::clause[${node.attrs?.id ?? ''}@${node.attrs?.version ?? 1}]`,
});

/**
 * The content extensions. Editor-only behaviour (placeholder, typography,
 * menus) is added by the editor on top; it never changes the schema.
 */
export const pageExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      isAllowedUri: (url) => linkable.test(url),
    },
  }),
  TableKit.configure({ table: { resizable: false } }),
  PageBreak,
  ClauseBlock,
];

/** The ProseMirror schema the page extensions define. */
export const pageSchema = getSchema(pageExtensions);
