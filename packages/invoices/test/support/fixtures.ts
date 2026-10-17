import {
  type Invoice,
  type Language,
  newInvoice,
  newLine,
} from '@portfolio/invoices/model';
import { pagesFromMarkdown } from '@portfolio/invoices/page-markdown';
import { Result } from 'effect';
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

const proposal: Record<Language, string> = {
  en: `# The proposal

We redesign the booking flow so a first-time guest books in under a minute. The work runs in **two phases**, each ending in something you can *use*, not a slide deck.

## What we deliver

1. A research summary with the five problems that cost the most bookings.
2. A tested prototype of the new flow.
3. Production screens, a component library, and a handover session.

## Timeline

| Phase | Weeks | Ends with |
| --- | --- | --- |
| Research | 2 | Findings and priorities |
| Design and build | 6 | Live booking flow |

> Dates move with feedback: each review takes the team about two working days.

## Conditions

::clause[scope@1]

::clause[revisions@1]

::clause[payment-terms@1]

::clause[copyright@1]
`,
  es: `# La propuesta

Rediseñamos el proceso de reserva para que un cliente nuevo reserve en menos de un minuto. El trabajo tiene **dos fases**, y cada una termina en algo que se puede *usar*, no en una presentación.

## Qué entregamos

1. Un resumen de la investigación con los cinco problemas que más reservas cuestan.
2. Un prototipo probado del nuevo proceso.
3. Las pantallas de producción, una librería de componentes y una sesión de traspaso.

## Calendario

| Fase | Semanas | Termina con |
| --- | --- | --- |
| Investigación | 2 | Conclusiones y prioridades |
| Diseño y desarrollo | 6 | Reserva en producción |

> Las fechas dependen de las revisiones: cada una lleva al equipo unos dos días laborables.

## Condiciones

::clause[scope@1]

::clause[revisions@1]

::clause[payment-terms@1]

::clause[copyright@1]
`,
};

/** A consumer quote with written pages, for renderer and notice tests. */
export function quoteSpecimen(language: Language = 'en'): Invoice {
  const draft = specimen(language);
  return {
    ...draft,
    data: {
      ...draft.data,
      kind: 'quote',
      customerType: 'consumer',
      customer: {
        ...draft.data.customer,
        name: language === 'es' ? 'Lucía Martín' : 'Lucy Martin',
        taxId: '00000000T',
      },
      quote: {
        validUntil: '2026-10-09',
        pages: Result.getOrThrow(pagesFromMarkdown(proposal[language])),
      },
    },
  };
}
