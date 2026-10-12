import { clauseVersion } from '@portfolio/invoices/clauses';
import type { Language } from '@portfolio/invoices/model';
import { markdownToJSON } from '@portfolio/invoices/page-markdown';
import { pageExtensions } from '@portfolio/invoices/page-schema';
import {
  type Pages,
  readPages,
  toJSONContent,
} from '@portfolio/invoices/pages';
import type { JSONContent } from '@tiptap/core';
import { renderToReactElement } from '@tiptap/static-renderer/pm/react';
import type { ReactNode } from 'react';

// A quote's pages as a web page reads them: the same prose styles as the
// editor (`.iv-prose`), so the customer reads what the owner wrote. A clause
// shows the library's words for its version in the quote's language.

function render(content: JSONContent, language: Language): ReactNode {
  return renderToReactElement({
    content,
    extensions: pageExtensions,
    options: {
      nodeMapping: {
        clause: ({ node }) => <Clause node={node} language={language} />,
        pageBreak: () => <hr className="iv-prose-break" aria-hidden />,
      },
    },
  });
}

function Clause({
  node,
  language,
}: {
  node: { attrs: Record<string, unknown> };
  language: Language;
}) {
  const found = clauseVersion(
    String(node.attrs.id ?? ''),
    Number(node.attrs.version ?? 1),
  );
  if (!found) return null;
  const text = found.text[language];
  return (
    <section className="iv-prose-clause">
      <h4>{text.title}</h4>
      {render(markdownToJSON(text.body), language)}
      <p className="iv-prose-source">{found.source}</p>
    </section>
  );
}

/** The pages, read-only. */
export function PageView({
  pages,
  language,
}: {
  pages: Pages;
  language: Language;
}) {
  return (
    <div className="iv-prose" lang={language}>
      {render(toJSONContent(readPages(pages)), language)}
    </div>
  );
}
