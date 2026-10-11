import { createHash } from 'node:crypto';
import type { CSSProperties, ReactNode } from 'react';
import { render } from 'takumi-pdf';
import { PageNumber, TotalPages } from 'takumi-pdf/primitives';
import type { CountryCode } from './address';
import { planTerms } from './billing';
import { calculate, formatMoney, type Totals } from './calculate';
import ember from './covers/ember.jpg?inline';
import moss from './covers/moss.jpg?inline';
import rose from './covers/rose.jpg?inline';
import tide from './covers/tide.jpg?inline';
import italic from './fonts/Geist-Italic.ttf?inline';
import medium from './fonts/Geist-Medium.ttf?inline';
import regular from './fonts/Geist-Regular.ttf?inline';
import semibold from './fonts/Geist-SemiBold.ttf?inline';
import semiboldItalic from './fonts/Geist-SemiBoldItalic.ttf?inline';
import { documentLabels, formatDay } from './labels';
import type { Cover, Invoice, Language, Party } from './model';
import { QuoteAppendix } from './page-render';
import { partyLines } from './party-lines';
import { faint, ink, label, rule, ruleStrong, side, soft } from './pdf-style';
import type { PaymentPlan } from './plan';

const covers: Record<Exclude<Cover, 'none'>, string> = {
  ember,
  tide,
  moss,
  rose,
};

const detail: CSSProperties = { fontSize: 11, lineHeight: 1.65, color: soft };
const cell: CSSProperties = {
  padding: '11px 0',
  verticalAlign: 'top',
  borderBottom: `1px solid ${rule}`,
};
const figure: CSSProperties = {
  ...cell,
  textAlign: 'right',
  whiteSpace: 'nowrap',
};
const heading: CSSProperties = {
  ...label,
  padding: '0 0 9px',
  borderBottom: `1px solid ${ruleStrong}`,
};

function Labelled({
  title,
  align = 'left',
  children,
}: {
  title: string;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'right' ? 'flex-end' : 'flex-start',
        gap: 7,
      }}
    >
      <p style={label}>{title}</p>
      {children}
    </div>
  );
}

/**
 * A party's block: the address as its own country's post prints it, and the
 * country only when it differs from `home`, the issuer's country. A letter
 * within Spain does not say "Spain".
 */
function PartyBlock({
  party,
  home,
  language,
  title,
  taxLabel,
  extra = [],
}: {
  party: Party;
  home: CountryCode;
  language: Language;
  title: string;
  taxLabel: string;
  extra?: string[];
}) {
  const lines = partyLines(party, { home, language, taxLabel, extra });
  return (
    <div style={{ width: '36%', paddingRight: 20 }}>
      <Labelled title={title}>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: ink }}>
          {party.name || '—'}
        </p>
        <p style={{ ...detail, whiteSpace: 'pre-wrap' }}>{lines.join('\n')}</p>
      </Labelled>
    </div>
  );
}

// Screen and print output only: this renderer makes no PDF/A or tagged-PDF
// claim. Validate any conformance target with veraPDF against real invoices
// before advertising it.
function lineNet(lines: Totals['lines'], index: number, id: string): string {
  const found = lines[index];
  if (found === undefined || found.id !== id)
    throw new Error('The printed line does not match the calculated totals.');
  return found.net;
}

/** Renders the invoice document for preview, download, and print. */
export function InvoiceDocument({
  invoice,
  language = invoice.data.language,
  plans = [],
}: {
  invoice: Invoice;
  language?: Language;
  /** A quote's payment plans, printed as part of what the customer accepts. */
  plans?: readonly PaymentPlan[];
}) {
  const d = invoice.data;
  const t = documentLabels[language];
  const totals = calculate(d);
  const money = (value: string) => formatMoney(value, language, d.currency);
  const quantity = new Intl.NumberFormat(language, {
    maximumFractionDigits: 6,
  });
  const dates = [
    { title: t.issued, value: d.issueDate },
    ...(d.supplyDate === d.issueDate
      ? []
      : [
          { title: d.quote ? t.plannedStart : t.supplied, value: d.supplyDate },
        ]),
    d.quote
      ? { title: t.validUntil, value: d.quote.validUntil }
      : { title: t.due, value: d.dueDate },
  ];
  const summary = [
    { title: t.subtotal, value: totals.subtotal },
    ...(totals.discount === '0.00'
      ? []
      : [{ title: t.discount, value: `-${totals.discount}` }]),
    ...totals.groups.map((group) => ({
      title:
        group.treatment === 'taxable'
          ? `IGIC ${group.rate}% ${t.on} ${money(group.base)}`
          : `${t[group.treatment]} ${t.on} ${money(group.base)}`,
      value: group.tax,
    })),
    ...(totals.withholding === '0.00'
      ? []
      : [
          {
            title: `${t.withholding} ${d.withholdingRate}%`,
            value: `-${totals.withholding}`,
          },
        ]),
    ...(totals.disbursements === '0.00'
      ? []
      : [{ title: t.disbursements, value: totals.disbursements }]),
  ];
  const bank = [
    d.issuer.bankName && `${t.bank}: ${d.issuer.bankName}`,
    d.issuer.iban && `${t.iban}: ${d.issuer.iban}`,
    d.issuer.bic && `${t.bic}: ${d.issuer.bic}`,
  ].filter(Boolean);
  const legends = [
    ...new Set(d.lines.map((line) => line.tax.reason).filter(Boolean)),
  ];
  return (
    <main
      style={{
        fontFamily: 'Geist',
        color: ink,
        fontSize: 11,
        lineHeight: 1.5,
      }}
    >
      {d.cover !== 'none' && (
        // The renderer ignores border-radius on <img>, so a clipping box
        // rounds the corners instead.
        <div
          style={{
            display: 'flex',
            height: 170,
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: 30,
          }}
        >
          <img
            src={covers[d.cover]}
            alt=""
            style={{ width: '100%', height: 170 }}
          />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 30,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '0.01em',
              textTransform: 'uppercase',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {t[d.kind]}
          </h1>
          <p style={{ fontSize: 12.5, fontWeight: 500, color: soft }}>
            {invoice.status === 'draft' ? t.draft : invoice.number}
          </p>
        </div>
        <p style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>
          {d.issuer.name}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <PartyBlock
          party={d.issuer}
          home={d.issuer.address.country}
          language={d.language}
          title={t.from}
          taxLabel={t.taxId}
          extra={[d.issuer.website]}
        />
        <PartyBlock
          party={d.customer}
          home={d.issuer.address.country}
          language={d.language}
          title={d.quote ? t.preparedFor : t.billTo}
          taxLabel={t.taxId}
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 14,
          }}
        >
          {dates.map((item) => (
            <Labelled key={item.title} title={item.title} align="right">
              <p style={{ fontSize: 12, color: ink }}>
                {formatDay(item.value, language)}
              </p>
            </Labelled>
          ))}
        </div>
      </div>
      <div
        style={{
          borderTop: `1px solid ${rule}`,
          marginTop: 26,
          paddingTop: d.title || d.reference || d.correction ? 18 : 0,
          marginBottom: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {d.title && <p style={{ fontSize: 13, fontWeight: 500 }}>{d.title}</p>}
        {d.reference && (
          <p style={detail}>
            {t.reference}: {d.reference}
          </p>
        )}
        {d.correction && (
          <p style={detail}>
            {t.correction} {d.correction.number}. {t.reason}:{' '}
            {d.correction.reason}
          </p>
        )}
      </div>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        {/* Only the description column takes a width: the renderer drops
            text-align on any cell with an explicit width, so the three
            figure columns split the remaining space evenly instead. */}
        <thead>
          <tr>
            <th style={{ ...heading, textAlign: 'left', width: '52%' }}>
              {t.description}
            </th>
            <th style={{ ...heading, textAlign: 'right' }}>{t.quantity}</th>
            <th style={{ ...heading, textAlign: 'right' }}>{t.price}</th>
            <th style={{ ...heading, textAlign: 'right' }}>{t.amount}</th>
          </tr>
        </thead>
        <tbody>
          {d.lines.map((line, index) =>
            line.kind === 'note' ? (
              <tr key={line.id}>
                <td
                  colSpan={4}
                  style={{ ...cell, color: soft, whiteSpace: 'pre-wrap' }}
                >
                  {line.description}
                </td>
              </tr>
            ) : (
              <tr key={line.id} style={{ breakInside: 'avoid' }}>
                <td style={{ ...cell, paddingRight: 24 }}>
                  <p style={{ fontSize: 11.5, whiteSpace: 'pre-wrap' }}>
                    {line.description || '—'}
                  </p>
                  <p style={{ fontSize: 9.5, color: faint, marginTop: 3 }}>
                    {[
                      line.unit === 'unit' ? '' : line.unit,
                      line.tax.treatment === 'taxable'
                        ? `IGIC ${line.tax.rate}%`
                        : t[line.tax.treatment],
                      line.discount.value === '0'
                        ? ''
                        : `${t.discount} ${line.discount.kind === 'percent' ? `${line.discount.value}%` : money(line.discount.value)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </td>
                <td style={{ ...figure, fontSize: 11.5, color: soft }}>
                  {quantity.format(Number(line.quantity))}
                </td>
                <td style={{ ...figure, fontSize: 11.5, color: soft }}>
                  {money(line.unitPrice)}
                </td>
                <td style={{ ...figure, fontSize: 11.5, fontWeight: 500 }}>
                  {money(lineNet(totals.lines, index, line.id))}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 18,
          breakInside: 'avoid',
        }}
      >
        <div style={{ width: '42%', display: 'flex', flexDirection: 'column' }}>
          {summary.map((row, index) => (
            <div
              key={`${index}-${row.title}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                padding: '4px 0',
                fontSize: 11.5,
              }}
            >
              <span style={{ color: soft }}>{row.title}</span>
              <span>{money(row.value)}</span>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: `1px solid ${ruleStrong}`,
              marginTop: 10,
              paddingTop: 12,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>{t.total}</span>
            <span>{money(totals.total)}</span>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          marginTop: 36,
        }}
      >
        {d.quote && plans.length > 0 && (
          <div style={{ breakInside: 'avoid' }}>
            <Labelled title={plans.length > 1 ? t.choosePlan : t.plan}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plans.map((plan) => (
                  <p key={plan.id} style={{ ...detail, color: ink }}>
                    {plan.name && (
                      <span style={{ fontWeight: 600 }}>{plan.name}. </span>
                    )}
                    {planTerms(plan, language, d.currency, (day) =>
                      formatDay(day, language),
                    )}
                  </p>
                ))}
              </div>
            </Labelled>
          </div>
        )}
        {(d.paymentTerms || bank.length > 0) && (
          <div style={{ breakInside: 'avoid' }}>
            <Labelled title={t.terms}>
              <p style={{ ...detail, whiteSpace: 'pre-wrap' }}>
                {[d.paymentTerms, ...bank].filter(Boolean).join('\n')}
              </p>
            </Labelled>
          </div>
        )}
        {d.notes && (
          <div style={{ breakInside: 'avoid' }}>
            <Labelled title={t.notes}>
              <p style={{ ...detail, whiteSpace: 'pre-wrap' }}>{d.notes}</p>
            </Labelled>
          </div>
        )}
        {legends.length > 0 && (
          <p
            style={{
              fontSize: 9.5,
              lineHeight: 1.6,
              color: faint,
              whiteSpace: 'pre-wrap',
              breakInside: 'avoid',
            }}
          >
            {legends.join('\n')}
          </p>
        )}
      </div>
      {d.quote && (
        <QuoteAppendix
          data={d}
          quote={d.quote}
          number={invoice.status === 'draft' ? null : invoice.number}
          language={language}
        />
      )}
    </main>
  );
}

/** Returns the exact document bytes used by preview, download, and print. Fonts and cover art never require a network request. */
export async function renderInvoice(
  invoice: Invoice,
  language: Language = invoice.data.language,
  plans: readonly PaymentPlan[] = [],
): Promise<Uint8Array> {
  const t = documentLabels[language];
  const fonts = [
    { url: regular, weight: 400, style: 'normal' },
    { url: italic, weight: 400, style: 'italic' },
    { url: medium, weight: 500, style: 'normal' },
    { url: semibold, weight: 600, style: 'normal' },
    { url: semiboldItalic, weight: 600, style: 'italic' },
  ].map((font) => ({
    name: 'Geist',
    data: Buffer.from(font.url.slice(font.url.indexOf(',') + 1), 'base64'),
    weight: font.weight,
    style: font.style,
  }));
  return render(
    <InvoiceDocument invoice={invoice} language={language} plans={plans} />,
    {
      size: 'a4',
      margin: { top: 40, right: side, bottom: 52, left: side },
      fonts,
      css: 'p, h1, h2, h3 { margin: 0 }',
      // A quote's pages carry headings worth jumping to; an invoice has one.
      outline: invoice.data.kind === 'quote',
      pdfa: '2a',
      tagged: 'ua1',
      lang: language,
      metadata: {
        title: `${t[invoice.data.kind]} ${invoice.number || t.draft}`,
        authors: [invoice.data.issuer.name || 'Invoice workspace'],
        creationDate: invoice.createdAt.slice(0, 19),
      },
      footer: (
        <div
          style={{
            display: 'flex',
            width: '100%',
            justifyContent: 'space-between',
            fontFamily: 'Geist',
            fontSize: 8.5,
            color: faint,
            padding: `0 ${side}px`,
          }}
        >
          <span>{invoice.number || t.draft}</span>
          <span>
            {t.page} <PageNumber /> {t.of} <TotalPages />
          </span>
        </div>
      ),
    },
  );
}
/** SHA-256 hex of rendered bytes, used to skip duplicate artifact writes. */
export function pdfDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
