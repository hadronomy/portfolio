import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import type { InvoiceData, Language, QuoteTerms } from '#model';

// The notices a quote prints whatever its pages say. They follow from who
// the customer is and from the quote being accepted online, so the owner
// cannot leave one out by accident. docs/research/quotes-editor-mcp.md maps
// each one to its source.

export interface Notice {
  readonly id:
    | 'validity'
    | 'taxes'
    | 'acceptance'
    | 'withdrawal'
    | 'complaints'
    | 'privacy';
  readonly title: string;
  readonly body: string;
  readonly source: string;
}

/** The required notices for a quote, in the order they print. */
export function quoteNotices(
  data: InvoiceData,
  quote: QuoteTerms,
  language: Language,
): readonly Notice[] {
  const t = translate(language);
  const consumer = data.customerType === 'consumer';
  // Decreto 90/2023 binds traders serving consumers in the Canary Islands.
  const canary =
    data.issuer.canaryEstablished ||
    data.customerTerritory === 'canary-islands';
  const issuer = data.issuer.name || '—';
  const email = data.issuer.email || '—';
  const notices: Notice[] = [
    {
      id: 'validity',
      title: t(m.notice_validity_title),
      body: t(m.notice_validity, { until: quote.validUntil }),
      source: consumer
        ? 'Ley 3/2003 de Canarias, art. 11.1.c; Código Civil, art. 1262'
        : 'Código Civil, arts. 1254 y 1262',
    },
  ];
  if (consumer)
    notices.push({
      id: 'taxes',
      title: t(m.notice_price_title),
      body: t(m.notice_price),
      source: 'Real Decreto Legislativo 1/2007, arts. 20.1.c y 60.2.c',
    });
  notices.push({
    id: 'acceptance',
    title: t(m.notice_acceptance_title),
    body: t(m.notice_acceptance, {
      issuer,
      language: t(m.notice_contract_language, { language: data.language }),
    }),
    source: 'Ley 34/2002, arts. 27 y 28; Reglamento (UE) 910/2014, art. 25.1',
  });
  if (consumer)
    notices.push({
      id: 'withdrawal',
      title: t(m.notice_withdrawal_title),
      body: t(m.notice_withdrawal, { email }),
      source:
        'Real Decreto Legislativo 1/2007, arts. 97.1.i, 98.8, 102, 103.a, 104.a, 106 y 108.4',
    });
  if (consumer && canary)
    notices.push({
      id: 'complaints',
      title: t(m.notice_complaints_title),
      body: t(m.notice_complaints, { email }),
      source: 'Decreto 90/2023 de Canarias, arts. 5 y 6',
    });
  notices.push({
    id: 'privacy',
    title: t(m.notice_privacy_title),
    body: t(m.notice_privacy, {
      controller: data.issuer.taxId
        ? `${issuer} (${data.issuer.taxId})`
        : issuer,
      email,
    }),
    source:
      'Reglamento (UE) 2016/679, arts. 6, 13, 14 y 44–46; Ley Orgánica 3/2018, art. 11',
  });
  return notices;
}

/** Whether the quote prints the model withdrawal form: only a consumer can withdraw. */
export const printsWithdrawalForm = (data: InvoiceData) =>
  data.kind === 'quote' && data.customerType === 'consumer';
