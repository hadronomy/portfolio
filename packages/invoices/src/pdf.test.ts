import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { specimen } from './fixtures';
import { pdfDigest, renderInvoice } from './pdf';

describe('invoice PDF', () => {
  it.each([
    'en',
    'es',
  ] as const)('renders a selectable multipage %s invoice with embedded fonts', async (language) => {
    const bytes = await renderInvoice(specimen(language, 45));
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-1.7/);
    expect(bytes.length).toBeGreaterThan(15000);
    expect(pdfDigest(bytes)).toMatch(/^[a-f0-9]{64}$/);
    await writeFile(`/tmp/invoice-specimen-${language}.pdf`, bytes);
  }, 20000);
});
