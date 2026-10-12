import type { JSONContent } from '@tiptap/core';
import { pageSchema } from './page-schema';

/** Why the page schema rejects a document, or undefined when it accepts it. */
export function schemaIssue(doc: JSONContent): string | undefined {
  try {
    pageSchema.nodeFromJSON(doc).check();
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid page content.';
  }
}
