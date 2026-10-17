import {
  pagesFromMarkdown,
  pagesToMarkdown,
} from '@portfolio/invoices/page-markdown';
import {
  clausesIn,
  outline,
  pagesFrom,
  readPages,
} from '@portfolio/invoices/pages';
import { Result } from 'effect';
import { describe, expect, it } from 'vitest';

const proposal = `# Proposal

We redesign the **booking flow** and ship it in [two phases](https://example.com/plan).

## Phases

1. Research
2. Design

| Phase | Weeks |
| --- | --- |
| Research | 2 |
| Design | 4 |

::page-break

## Conditions

::clause[late-payment@1]
`;

describe('pages', () => {
  it('read Markdown with page breaks, clauses and tables', () => {
    const pages = Result.getOrThrow(pagesFromMarkdown(proposal));
    const types = (readPages(pages).content ?? []).map((node) => node.type);
    expect(types).toContain('table');
    expect(types).toContain('pageBreak');
    expect(clausesIn(pages)).toEqual([{ id: 'late-payment', version: 1 }]);
    expect(outline(pages).map((item) => item.text)).toEqual([
      'Proposal',
      'Phases',
      'Conditions',
    ]);
  });

  it('write the same document back as Markdown', () => {
    const pages = Result.getOrThrow(pagesFromMarkdown(proposal));
    expect(pagesFromMarkdown(pagesToMarkdown(pages))).toEqual(
      Result.succeed(pages),
    );
  });

  it('refuse a clause the library does not publish', () => {
    expect(Result.isFailure(pagesFromMarkdown('::clause[made-up@1]\n'))).toBe(
      true,
    );
  });

  it('refuse nodes outside the page schema', () => {
    const result = pagesFrom({
      type: 'doc',
      content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'x' }] }],
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  it('refuse a link the PDF cannot open', () => {
    expect(
      Result.isFailure(pagesFromMarkdown('[run](javascript:alert(1))\n')),
    ).toBe(true);
  });
});
