import { writeFile } from 'node:fs/promises';
import { Result, Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { clauses, latestVersion } from './clauses';
import { quoteSpecimen, specimen } from './fixtures';
import { asQuote, InvoiceData } from './model';
import { pagesFromMarkdown } from './page-markdown';
import { renderedTypes } from './page-render';
import { pageSchema } from './page-schema';
import { pdfDigest, renderInvoice } from './pdf';
import { quoteNotices } from './quote-notices';
import { issueErrors } from './validate';

const ids = (data: InvoiceData) =>
  data.quote
    ? quoteNotices(data, data.quote, 'en').map((notice) => notice.id)
    : [];

describe('quote pages', () => {
  it('print every node and mark the page schema allows', () => {
    expect(new Set(renderedTypes.nodes)).toEqual(
      new Set(Object.keys(pageSchema.nodes)),
    );
    expect(new Set(renderedTypes.marks)).toEqual(
      new Set(Object.keys(pageSchema.marks)),
    );
  });

  it('publish every clause in both languages, each with a source', () => {
    for (const clause of clauses)
      for (const version of clause.versions) {
        expect(version.source).not.toBe('');
        for (const text of Object.values(version.text)) {
          expect(text.title).not.toBe('');
          // A body is Markdown the page schema must accept.
          expect(Result.isSuccess(pagesFromMarkdown(text.body))).toBe(true);
        }
      }
    expect(
      clauses.map((clause) => latestVersion(clause).version),
    ).not.toContain(0);
  });
});

describe('quote notices', () => {
  it.each([
    'es',
    'en',
  ] as const)('names the controller, processors and transfers in %s', (language) => {
    const data = quoteSpecimen(language).data;
    if (!data.quote) throw new Error('The specimen must be a quote.');
    const notice = quoteNotices(data, data.quote, language).find(
      ({ id }) => id === 'privacy',
    );
    for (const text of [
      data.issuer.name,
      data.issuer.taxId,
      data.issuer.email,
      'Vercel',
      'Cloudflare',
      'Neon/Databricks',
      'Resend',
      'Stripe',
      'Photon/komoot',
      'MCP',
      'SHA-256',
      'https://hadronomy.com/invoices/privacy',
    ])
      expect(notice?.body).toContain(text);
  });

  it('tell a consumer about withdrawal, taxes and complaints', () => {
    expect(ids(quoteSpecimen().data)).toEqual([
      'validity',
      'taxes',
      'acceptance',
      'withdrawal',
      'complaints',
      'privacy',
    ]);
  });

  it('leave consumer rights out of a business quote', () => {
    const data = { ...quoteSpecimen().data, customerType: 'business' as const };
    expect(ids(data)).toEqual(['validity', 'acceptance', 'privacy']);
  });
});

describe('quote issue rules', () => {
  it('accept the specimen', () => {
    expect(issueErrors(quoteSpecimen().data)).toEqual([]);
  });

  it('refuse a business-only clause for a consumer', () => {
    const data = quoteSpecimen().data;
    const pages = Result.getOrThrow(
      pagesFromMarkdown('::clause[late-payment@1]\n'),
    );
    const errors = issueErrors({
      ...data,
      quote: { validUntil: '2026-10-09', pages },
    });
    expect(errors.map((error) => error.path)).toContain('quote.pages');
  });

  it('refuse a validity that ends before the issue date', () => {
    const data = quoteSpecimen().data;
    const pages = Result.getOrThrow(pagesFromMarkdown('Hello\n'));
    const errors = issueErrors({
      ...data,
      quote: { validUntil: '2026-09-01', pages },
    });
    expect(errors.map((error) => error.path)).toContain('quote.validUntil');
  });

  it('keep quote terms to quotes', () => {
    const data = specimen().data;
    const decode = Schema.decodeUnknownResult(InvoiceData);
    expect(decode({ ...data, quote: asQuote(data).quote })._tag).toBe(
      'Failure',
    );
    expect(decode(asQuote(data))._tag).toBe('Success');
  });
});

describe('quote PDF', () => {
  it.each([
    'en',
    'es',
  ] as const)('renders a %s consumer quote with pages, notices and the withdrawal form', async (language) => {
    const bytes = await renderInvoice(quoteSpecimen(language));
    expect(pdfDigest(bytes)).toMatch(/^[a-f0-9]{64}$/);
    await writeFile(`/tmp/quote-specimen-${language}.pdf`, bytes);
  }, 30000);
});
