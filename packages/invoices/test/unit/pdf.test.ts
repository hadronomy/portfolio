import { writeFile } from 'node:fs/promises';
import { specimen } from '@portfolio/invoices/fixtures';
import { pdfDigest, renderInvoice } from '@portfolio/invoices/pdf';
import { describe, expect, it } from 'vitest';

describe('invoice PDF', () => {
  it.each([
    'en',
    'es',
  ] as const)('renders a selectable multipage %s invoice with embedded fonts', async (language) => {
    const started = performance.now();
    const bytes = await renderInvoice(specimen(language, 45));
    const elapsed = performance.now() - started;
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-1.7/);
    expect(bytes.length).toBeGreaterThan(15000);
    expect(pdfDigest(bytes)).toMatch(/^[a-f0-9]{64}$/);
    // Measured generation time for a 45-line invoice, not an assumed library
    // figure. Vitest prints the per-test duration alongside this budget.
    expect(elapsed).toBeLessThan(15_000);
    await writeFile(`/tmp/invoice-specimen-${language}.pdf`, bytes);
  }, 20000);
});
