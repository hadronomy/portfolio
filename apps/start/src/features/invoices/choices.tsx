import type { Line } from '@portfolio/invoices/model';
import { Bars, type Option } from '~/features/invoices/ui';

// Every closed list in the workspace, with the one line of help each choice
// needs. Select shows the line for whichever option is highlighted, so the
// owner reads what a choice means before making it.

const rates = ['0', '3', '5', '7', '9.5', '15', '20'] as const;
const rateHints: Partial<Record<(typeof rates)[number], string>> = {
  '0': 'Tipo cero. IGIC is charged at 0%.',
  '3': 'Tipo reducido.',
  '7': 'Tipo general. The usual rate for professional services.',
  '9.5': 'Tipo incrementado.',
  '15': 'Tipo incrementado.',
  '20': 'Tipo especial incrementado.',
};

/** IGIC rates, with bars showing where each sits in the range. */
export const igicRates: readonly Option<string>[] = rates.map(
  (rate, index) =>
    [
      rate,
      `${rate}%`,
      {
        icon: <Bars level={index} of={rates.length - 1} />,
        ...(rateHints[rate] ? { hint: rateHints[rate] } : {}),
      },
    ] as const,
);

export const lineKinds: readonly Option<Line['kind']>[] = [
  [
    'service',
    'Service',
    { hint: 'Work delivered: design, development, advice.' },
  ],
  ['product', 'Product', { hint: 'Goods sold or delivered.' }],
  ['time', 'Time', { hint: 'Billed by the hour or the day.' }],
  ['expense', 'Expense', { hint: 'A cost passed on, taxed like the rest.' }],
  ['shipping', 'Shipping', { hint: 'Delivery or transport of goods.' }],
  ['fee', 'Fee', { hint: 'A one-off charge.' }],
  [
    'disbursement',
    'Disbursement',
    { hint: 'Paid on the customer’s behalf. Kept out of the taxable base.' },
  ],
  ['note', 'Note', { hint: 'Text across the table. No amounts.' }],
];

export const treatments: readonly Option<Line['tax']['treatment']>[] = [
  ['taxable', 'Taxable', { hint: 'IGIC is charged at the line’s rate.' }],
  [
    'exempt',
    'Exempt',
    { hint: 'No IGIC. Print the article that exempts it as the legal basis.' },
  ],
  [
    'outside-scope',
    'Outside scope',
    {
      hint: 'Not subject to IGIC (no sujeta). Give the reason as the legal basis.',
    },
  ],
  [
    'reverse-charge',
    'Reverse charge',
    {
      hint: 'The customer accounts for the tax (inversión del sujeto pasivo).',
    },
  ],
];

export const adjustments: readonly Option<'percent' | 'amount'>[] = [
  ['percent', 'Percentage', { hint: 'A share of the amount it applies to.' }],
  ['amount', 'Fixed amount', { hint: 'An amount in the invoice currency.' }],
];

export const customerTypes: readonly Option<'business' | 'consumer'>[] = [
  [
    'business',
    'Business',
    { hint: 'A company or a self-employed professional.' },
  ],
  ['consumer', 'Consumer', { hint: 'A private individual.' }],
];

export type Territory = 'canary-islands' | 'mainland-spain' | 'eu' | 'other';
export const territories: readonly Option<Territory>[] = [
  ['canary-islands', 'Canary Islands', { hint: 'Inside the IGIC territory.' }],
  [
    'mainland-spain',
    'Mainland Spain / Balearics',
    { hint: 'Spain outside the Canary Islands.' },
  ],
  ['eu', 'European Union', { hint: 'Another EU member state.' }],
  ['other', 'Other', { hint: 'Outside the European Union.' }],
];

export const territoryNames: Record<Territory, string> = {
  'canary-islands': 'Canary Islands',
  'mainland-spain': 'Mainland Spain',
  eu: 'European Union',
  other: 'Other',
};

export const currencies: readonly Option<'EUR' | 'USD' | 'GBP'>[] = [
  ['EUR', 'EUR · Euro', { hint: 'Amounts print in euros.' }],
  ['USD', 'USD · US dollar', { hint: 'Amounts print in dollars.' }],
  ['GBP', 'GBP · Pound sterling', { hint: 'Amounts print in pounds.' }],
];

export const languages: readonly Option<'en' | 'es'>[] = [
  ['en', 'English'],
  ['es', 'Español'],
];

export const documentKinds: readonly Option<'invoice' | 'quote'>[] = [
  [
    'invoice',
    'Invoice',
    { hint: 'Takes the next number in the series when issued.' },
  ],
  [
    'quote',
    'Quote',
    {
      hint: 'An offer the customer accepts online. Numbered in its own P- series, with pages and conditions.',
    },
  ],
];

export const legalForms: readonly Option<'sole-trader' | 'company'>[] = [
  [
    'sole-trader',
    'Sole trader',
    { hint: 'Autónomo: you invoice in your own name.' },
  ],
  ['company', 'Company', { hint: 'A company invoices in its own name.' }],
];

export const regimes: readonly Option<'ordinary' | 'repep'>[] = [
  ['ordinary', 'Ordinary IGIC', { hint: 'IGIC is charged on taxable lines.' }],
  [
    'repep',
    'REPEP exemption',
    { hint: 'Small-business regime: new lines start exempt, with its legend.' },
  ],
];

export const activities: readonly Option<'professional' | 'business'>[] = [
  [
    'professional',
    'Professional',
    { hint: 'Services such as design or consulting.' },
  ],
  ['business', 'Business', { hint: 'Trade, shops, manufacturing.' }],
];

export const censusStates: readonly Option<'not-included' | 'included'>[] = [
  ['not-included', 'Not included'],
  ['included', 'Included'],
];

export const paymentMethods: readonly Option<
  'transfer' | 'card' | 'cash' | 'other'
>[] = [
  ['transfer', 'Transfer'],
  ['card', 'Card'],
  ['cash', 'Cash'],
  ['other', 'Other'],
];

/** The symbol a currency prints with: €, $, £. */
export function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  );
}
