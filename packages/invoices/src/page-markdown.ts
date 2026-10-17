import type { JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import type { Result } from 'effect';
import { pageExtensions } from '#page-schema';
import { type Pages, pagesFrom, readPages, toJSONContent } from '#pages';

// Pages as Markdown, the form agents read and write. It sits apart from
// pages.ts because the parser carries the whole editor schema, which a
// browser bundle only needs where pages are edited or drawn.

const markdown = new MarkdownManager({ extensions: pageExtensions });

/**
 * Markdown as a document tree, unvalidated. Page breaks are `::page-break`
 * and clauses `::clause[id@version]`, each on its own line.
 */
export function markdownToJSON(source: string): JSONContent {
  // The parser leaves `undefined` on keys it did not fill, which a strict
  // decode reads as a wrong type; a JSON round trip drops them.
  return JSON.parse(JSON.stringify(markdown.parse(source)));
}

/** Markdown as pages, the form an agent writes them in, or why it cannot be. */
export function pagesFromMarkdown(
  source: string,
): Result.Result<Pages, string> {
  return pagesFrom(markdownToJSON(source));
}

/** Pages as Markdown, the form an agent reads them in. */
export function pagesToMarkdown(pages: Pages): string {
  return markdown.serialize(toJSONContent(readPages(pages)));
}
