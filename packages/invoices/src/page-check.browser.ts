import type { JSONContent } from '@tiptap/core';

// Browser builds leave the schema check out: it would put the whole editor
// schema in the bundle of every page that touches an invoice. Pages in a
// browser came from the server, which checked them, or from the editor,
// which builds them from that schema; the server checks them again on the
// way back.

/** Always undefined: the server runs the real check. */
export function schemaIssue(_doc: JSONContent): string | undefined {
  return undefined;
}
