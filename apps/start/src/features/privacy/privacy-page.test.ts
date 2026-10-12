import { blankAddress } from '@portfolio/invoices/address';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Speak } from '../../lib/i18n';
import { CollectionNotice } from './collection-notice';
import { PrivacyPage } from './privacy-page';

const controller = {
  name: 'Nombre legal de prueba',
  taxId: 'NIF-DE-PRUEBA',
  email: 'privacy@example.org',
  address: {
    ...blankAddress(),
    lines: 'Dirección de prueba, 1',
    locality: 'Santa Cruz de Tenerife',
  },
};

describe('customer privacy information', () => {
  it.each([
    'es',
    'en',
  ] as const)('shows supplied identity and every section in %s', (language) => {
    const html = renderToStaticMarkup(
      createElement(PrivacyPage, { language, controller }),
    );
    for (const value of [
      controller.name,
      controller.taxId,
      controller.email,
      controller.address.lines,
      'Vercel',
      'Cloudflare',
      'Neon',
      'Resend',
      'Stripe',
      'Photon',
      'SHA-256',
      'AEPD',
    ])
      expect(html).toContain(value);
    for (const id of [
      'purposes',
      'data',
      'recipients',
      'transfers',
      'retention',
      'rights',
      'required',
      'cookies',
    ])
      expect(html).toContain(`id="${id}"`);
    expect(html).toContain('mailto:privacy@example.org');
    expect(html).toContain('href="?lang=en"');
  });

  it('shows incomplete controller information without inventing an identity', () => {
    const html = renderToStaticMarkup(
      createElement(PrivacyPage, { language: 'en', controller: null }),
    );
    expect(html).toContain('contact details are incomplete');
    expect(html).not.toContain('mailto:');
  });

  it.each([
    'signin',
    'payment',
    'quote',
  ] as const)('links the %s collection notice in the current language', (purpose) => {
    const html = renderToStaticMarkup(
      createElement(Speak, {
        locale: 'en',
        children: createElement(CollectionNotice, {
          purpose,
          controller: controller.name,
        }),
      }),
    );
    expect(html).toContain(controller.name);
    expect(html).toContain('/invoices/privacy?lang=en');
    if (purpose === 'quote')
      for (const word of [
        'simple electronic signature',
        'UTC',
        'IP address',
        'user agent',
        'SHA-256',
      ])
        expect(html).toContain(word);
  });
});
