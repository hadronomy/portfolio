import type { JSONContent } from '@tiptap/core';
import { Result, Schema } from 'effect';
import { schemaIssue } from '#page-check';
import { clauseVersion } from './clauses';
import { linkable } from './page-links';

// A quote's pages: the long-form writing that follows the priced lines.
// They are stored and sent as ProseMirror JSON text. A flat string crosses
// the form, the wire, and the database as one value, where a recursive
// tree would sink the form library's types; the tree is parsed back only
// where it is read. A document is valid when the page schema accepts it
// and every clause it places exists in the library.

/** A mark on a text node, as ProseMirror's JSON writes it. */
export interface PageMark {
  readonly type: string;
  readonly attrs?: Schema.JsonObject;
}

/** A node of a page document, as ProseMirror's JSON writes it. */
export interface PageNode {
  readonly type: string;
  readonly attrs?: Schema.JsonObject;
  readonly content?: readonly PageNode[];
  readonly marks?: readonly PageMark[];
  readonly text?: string;
}

const Attrs = Schema.Record(Schema.String, Schema.Json);

const PageMark = Schema.Struct({
  type: Schema.String,
  attrs: Schema.optionalKey(Attrs),
});

const PageNode = Schema.Struct({
  type: Schema.String,
  attrs: Schema.optionalKey(Attrs),
  content: Schema.optionalKey(
    Schema.Array(Schema.suspend((): Schema.Codec<PageNode> => PageNode)),
  ),
  marks: Schema.optionalKey(Schema.Array(PageMark)),
  text: Schema.optionalKey(Schema.String),
});

/** Large enough for a long proposal; small enough to keep a row cheap. */
const maxCharacters = 400_000;

function* placedClauses(node: PageNode): Generator<PageNode> {
  if (node.type === 'clause') yield node;
  for (const child of node.content ?? []) yield* placedClauses(child);
}

function* linkTargets(node: PageNode): Generator<string> {
  for (const mark of node.marks ?? [])
    if (mark.type === 'link') yield String(mark.attrs?.href ?? '');
  for (const child of node.content ?? []) yield* linkTargets(child);
}

/** Copies a node into the mutable shape Tiptap's APIs take. */
export function toJSONContent(node: PageNode): JSONContent {
  return {
    type: node.type,
    ...(node.attrs ? { attrs: { ...node.attrs } } : {}),
    ...(node.content ? { content: node.content.map(toJSONContent) } : {}),
    ...(node.marks
      ? {
          marks: node.marks.map((mark) => ({
            type: mark.type,
            ...(mark.attrs ? { attrs: { ...mark.attrs } } : {}),
          })),
        }
      : {}),
    ...(node.text === undefined ? {} : { text: node.text }),
  };
}

/** Why a text is not valid pages, or undefined when it is. */
function documentIssue(text: string): string | undefined {
  if (text.length > maxCharacters) return 'Pages are too long to store.';
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 'Pages are not valid JSON.';
  }
  const decoded = Schema.decodeUnknownResult(PageNode)(parsed);
  if (Result.isFailure(decoded)) return 'Pages are not a document.';
  const doc = decoded.success;
  if (doc.type !== 'doc') return 'Pages start with a document node.';
  const invalid = schemaIssue(toJSONContent(doc));
  if (invalid) return invalid;
  // The editor only offers these targets, but Markdown and the wire can
  // carry anything; a `javascript:` link must never reach a PDF.
  for (const href of linkTargets(doc))
    if (!linkable.test(href)) return `Links cannot open ${href}.`;
  for (const clause of placedClauses(doc)) {
    const id = String(clause.attrs?.id ?? '');
    const version = Number(clause.attrs?.version ?? 1);
    if (!clauseVersion(id, version))
      return `Clause ${id}@${version} is not in the library.`;
  }
  return undefined;
}

/** One quote's pages, as validated ProseMirror JSON text. */
export const Pages = Schema.String.check(
  Schema.makeFilter((text: string) => documentIssue(text)),
).pipe(Schema.brand('Pages'));
export type Pages = typeof Pages.Type;

/** The document tree of valid pages. */
export function readPages(pages: Pages): PageNode {
  return JSON.parse(pages);
}

/**
 * Pages from an editor's or a parser's JSON, or the reason they are not
 * valid. Every boundary that did not write the text itself goes through it.
 */
export function pagesFrom(content: JSONContent): Result.Result<Pages, string> {
  const text = JSON.stringify(content);
  const issue = documentIssue(text);
  return issue === undefined
    ? Result.succeed(Pages.make(text))
    : Result.fail(issue);
}

/** Pages with nothing written yet. */
export const blankPages = Pages.make(
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
);

/** The text of a node and its descendants, without marks. */
export function nodeText(node: PageNode): string {
  if (node.text !== undefined) return node.text;
  return (node.content ?? []).map(nodeText).join('');
}

/** The headings of the pages, in order: the editor's outline. */
export function outline(
  pages: Pages,
): readonly { level: number; text: string; index: number }[] {
  return (readPages(pages).content ?? []).flatMap((node, index) =>
    node.type === 'heading'
      ? [{ level: Number(node.attrs?.level ?? 1), text: nodeText(node), index }]
      : [],
  );
}

/** Whether the owner has written anything: an empty paragraph does not count. */
export function hasPages(pages: Pages): boolean {
  return (readPages(pages).content ?? []).some(
    (node) => node.type !== 'paragraph' || (node.content?.length ?? 0) > 0,
  );
}

/** The clauses the pages place, in order. */
export function clausesIn(
  pages: Pages,
): readonly { id: string; version: number }[] {
  return [...placedClauses(readPages(pages))].map((node) => ({
    id: String(node.attrs?.id ?? ''),
    version: Number(node.attrs?.version ?? 1),
  }));
}
