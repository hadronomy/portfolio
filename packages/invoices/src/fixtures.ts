import { type Invoice, type Language, newInvoice, newLine } from './model';
/** Synthetic records for renderer and calculation tests; they never enter the owner's database. */
export function specimen(language: Language = 'en', count = 3): Invoice {
  const draft = newInvoice(undefined, new Date('2026-09-09T12:00:00Z'));
  return {
    ...draft,
    data: {
      ...draft.data,
      language,
      title:
        language === 'es'
          ? 'Diseño e ingeniería de producto'
          : 'Product design & engineering',
      issuer: {
        ...draft.data.issuer,
        name: 'Estudio Ejemplo',
        taxId: 'TEST-ISSUER',
        email: 'hello@example.com',
        address: {
          ...draft.data.issuer.address,
          lines: 'Calle de ejemplo, 12',
          postalCode: '38001',
          locality: 'Santa Cruz de Tenerife',
          region: 'Santa Cruz de Tenerife',
        },
        website: 'example.com',
        bankName: 'Example Bank',
        iban: 'ES00 0000 0000 0000 0000 0000',
        bic: 'EXAMPLEXXX',
      },
      customer: {
        ...draft.data.customer,
        name: 'Example Company',
        taxId: 'TEST-CUSTOMER',
        email: 'accounts@example.org',
        address: {
          ...draft.data.customer.address,
          lines: 'Example Street, 24',
          postalCode: '35001',
          locality: 'Las Palmas de Gran Canaria',
          region: 'Las Palmas',
        },
      },
      notes:
        language === 'es'
          ? 'Gracias por confiar en nosotros.'
          : 'Thank you for your business.',
      lines: Array.from({ length: count }, (_, index) => ({
        ...newLine(),
        description:
          (language === 'es'
            ? [
                'Estrategia y dirección de producto',
                'Diseño de interfaces',
                'Desarrollo e implementación',
              ]
            : [
                'Product strategy & direction',
                'Interface design',
                'Development & implementation',
              ])[index % 3] ?? '',
        quantity: String((index % 3) + 1),
        unitPrice: String([850, 425, 175][index % 3]),
        unit: language === 'es' ? 'jornada' : 'day',
      })),
    },
  };
}
