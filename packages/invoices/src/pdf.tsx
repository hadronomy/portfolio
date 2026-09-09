import { createHash } from 'node:crypto';
import type { CSSProperties } from 'react';
import { render } from 'takumi-pdf';
import { PageNumber, TotalPages } from 'takumi-pdf/primitives';
import { calculate, formatMoney } from './calculate';
import bold from './fonts/DMSans-Bold.ttf?inline';
import regular from './fonts/DMSans-Regular.ttf?inline';
import { documentLabels } from './labels';
import type { Invoice, Language, Party } from './model';

const ink = '#232221';
const muted = '#77716b';
const small: CSSProperties = { fontSize: 10, color: muted, lineHeight: 1.6 };
const cell: CSSProperties = {
  padding: '13px 0',
  verticalAlign: 'top',
  borderBottom: '1px solid #eeeae5',
};
const amount: CSSProperties = {
  ...cell,
  textAlign: 'right',
  whiteSpace: 'nowrap',
};
const date = (day: string, language: Language) =>
  new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));

function Address({ party, label }: { party: Party; label: string }) {
  return (
    <div style={{ width: '46%' }}>
      <p style={small}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 700, margin: '5px 0' }}>
        {party.name || '—'}
      </p>
      <p style={{ fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {[
          party.taxId,
          party.address,
          `${party.postalCode} ${party.city}`.trim(),
          party.country,
        ]
          .filter(Boolean)
          .join('\n')}
      </p>
    </div>
  );
}

export function InvoiceDocument({
  invoice,
  language = invoice.data.language,
}: {
  invoice: Invoice;
  language?: Language;
}) {
  const d = invoice.data;
  const t = documentLabels[language];
  const totals = calculate(d);
  const money = (value: string) => formatMoney(value, language, d.currency);
  return (
    <main
      style={{
        fontFamily: 'DM Sans',
        color: ink,
        fontSize: 11,
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 36,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 42,
              fontWeight: 400,
              letterSpacing: -1.8,
              margin: 0,
            }}
          >
            {t[d.kind]}
          </h1>
          <p style={{ ...small, marginTop: 8 }}>
            {invoice.status === 'draft' ? t.draft : invoice.number}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 700, fontSize: 13 }}>
            {d.issuer.name || t.from}
          </p>
          <p style={small}>{d.issuer.website}</p>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '20px 0',
          borderTop: '1px solid #ded8d1',
          borderBottom: '1px solid #ded8d1',
          marginBottom: 26,
        }}
      >
        {[
          { label: t.number, value: invoice.number || '—' },
          { label: t.issued, value: date(d.issueDate, language) },
          { label: t.supplied, value: date(d.supplyDate, language) },
          { label: t.due, value: date(d.dueDate, language) },
        ].map((item) => (
          <div key={item.label}>
            <p style={small}>{item.label}</p>
            <p style={{ marginTop: 4 }}>{item.value}</p>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <Address party={d.issuer} label={t.from} />
        <Address party={d.customer} label={t.billTo} />
      </div>
      {d.title && (
        <h2 style={{ fontSize: 17, fontWeight: 500, marginBottom: 8 }}>
          {d.title}
        </h2>
      )}
      {d.reference && (
        <p style={small}>
          {t.reference}: {d.reference}
        </p>
      )}
      {d.correction && (
        <p style={{ fontSize: 11, marginBottom: 16 }}>
          {t.correction}: {d.correction.number}. {t.reason}:{' '}
          {d.correction.reason}
        </p>
      )}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr style={{ color: muted, fontSize: 10 }}>
            <th style={{ ...cell, textAlign: 'left', width: '49%' }}>
              {t.description}
            </th>
            <th style={{ ...amount, width: '11%' }}>{t.quantity}</th>
            <th style={{ ...amount, width: '20%' }}>{t.price}</th>
            <th style={{ ...amount, width: '20%' }}>{t.amount}</th>
          </tr>
        </thead>
        <tbody>
          {d.lines.map((line, index) =>
            line.kind === 'note' ? (
              <tr key={line.id}>
                <td
                  colSpan={4}
                  style={{ ...cell, color: muted, whiteSpace: 'pre-wrap' }}
                >
                  {line.description}
                </td>
              </tr>
            ) : (
              <tr key={line.id} style={{ breakInside: 'avoid' }}>
                <td style={{ ...cell, paddingRight: 18 }}>
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {line.description || '—'}
                  </p>
                  <p style={{ ...small, marginTop: 4 }}>
                    {line.unit}
                    {line.tax.treatment === 'taxable'
                      ? ` · IGIC ${line.tax.rate}%`
                      : ` · ${t[line.tax.treatment]}`}
                    {line.discount.value !== '0'
                      ? ` · ${t.discount} ${line.discount.kind === 'percent' ? `${line.discount.value}%` : money(line.discount.value)}`
                      : ''}
                  </p>
                </td>
                <td style={amount}>
                  {new Intl.NumberFormat(language, {
                    maximumFractionDigits: 6,
                  }).format(Number(line.quantity))}
                </td>
                <td style={amount}>{money(line.unitPrice)}</td>
                <td style={amount}>{money(totals.lines[index].net)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 24,
          breakInside: 'avoid',
        }}
      >
        <div style={{ width: '47%' }}>
          {[
            { label: t.subtotal, value: totals.subtotal },
            ...(totals.discount !== '0.00'
              ? [{ label: t.discount, value: `-${totals.discount}` }]
              : []),
            ...totals.groups.map((group) => ({
              label:
                group.treatment === 'taxable'
                  ? `IGIC ${group.rate}% · ${money(group.base)}`
                  : `${t[group.treatment]} · ${money(group.base)}`,
              value: group.tax,
            })),
            ...(totals.withholding !== '0.00'
              ? [
                  {
                    label: `${t.withholding} ${d.withholdingRate}%`,
                    value: `-${totals.withholding}`,
                  },
                ]
              : []),
            ...(totals.disbursements !== '0.00'
              ? [{ label: t.disbursements, value: totals.disbursements }]
              : []),
          ].map((row, index) => (
            <div
              key={`${index}-${row.label}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 9,
                gap: 12,
              }}
            >
              <span style={small}>{row.label}</span>
              <span>{money(row.value)}</span>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderTop: '1px solid #c8beb3',
              paddingTop: 14,
              marginTop: 12,
            }}
          >
            <strong>{t.total}</strong>
            <strong style={{ fontSize: 26, letterSpacing: -0.7 }}>
              {money(totals.total)}
            </strong>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 38, breakInside: 'avoid' }}>
        <h2 style={{ fontSize: 11, fontWeight: 700 }}>{t.terms}</h2>
        <p style={{ ...small, marginTop: 5, whiteSpace: 'pre-wrap' }}>
          {d.paymentTerms}
        </p>
        {d.issuer.iban && (
          <p style={{ fontSize: 11, marginTop: 8 }}>
            {d.issuer.bankName} · {d.issuer.iban}
            {d.issuer.bic ? ` · BIC ${d.issuer.bic}` : ''}
          </p>
        )}
      </div>
      {[...new Set(d.lines.map((line) => line.tax.reason).filter(Boolean))].map(
        (reason) => (
          <p
            key={reason}
            style={{ ...small, marginTop: 14, breakInside: 'avoid' }}
          >
            {reason}
          </p>
        ),
      )}
      {d.notes && (
        <div style={{ marginTop: 20, breakInside: 'avoid' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700 }}>{t.notes}</h2>
          <p style={{ ...small, marginTop: 6, whiteSpace: 'pre-wrap' }}>
            {d.notes}
          </p>
        </div>
      )}
    </main>
  );
}

/** Returns the exact document bytes used by preview, download, and print. Fonts never require a network request. */
export async function renderInvoice(
  invoice: Invoice,
  language: Language = invoice.data.language,
): Promise<Uint8Array> {
  const t = documentLabels[language];
  const fonts = await Promise.all(
    [
      { url: regular, weight: 400 },
      { url: bold, weight: 700 },
    ].map(async (font) => ({
      name: 'DM Sans',
      data: Buffer.from(font.url.slice(font.url.indexOf(',') + 1), 'base64'),
      weight: font.weight,
    })),
  );
  return render(<InvoiceDocument invoice={invoice} language={language} />, {
    size: 'a4',
    margin: { top: 48, right: 48, bottom: 62, left: 48 },
    fonts,
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
          fontFamily: 'DM Sans',
          fontSize: 9,
          color: muted,
          padding: '0 48px',
        }}
      >
        <span>{invoice.number || t.draft}</span>
        <span>
          {t.page} <PageNumber /> {t.of} <TotalPages />
        </span>
      </div>
    ),
  });
}
export function pdfDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
