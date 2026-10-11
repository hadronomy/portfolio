import type { JSONContent } from '@tiptap/core';
import {
  type JSONMarkType,
  type JSONNodeType,
  renderJSONContentToReactElement,
} from '@tiptap/static-renderer/json/react';
import type { CSSProperties, ReactNode } from 'react';
import { clauseVersion } from './clauses';
import { documentLabels } from './labels';
import type { InvoiceData, Language, QuoteTerms } from './model';
import { hasPages, markdownToJSON, readPages, toJSONContent } from './pages';
import { partyLines } from './party-lines';
import {
  faint,
  ink,
  label,
  measure,
  rule,
  ruleStrong,
  soft,
} from './pdf-style';
import { printsWithdrawalForm, quoteNotices } from './quote-notices';

// A quote's pages, notices and withdrawal form as the PDF prints them.
// Running text keeps to a 470px measure inside the 706px column; tables
// take the full column, because figures need the width more than prose.

type Props = {
  node: JSONNodeType;
  parent?: JSONNodeType;
  children?: ReactNode;
  renderElement: (props: {
    content: JSONNodeType;
    parent?: JSONNodeType;
  }) => ReactNode;
};
type MarkProps = { mark: JSONMarkType; children?: ReactNode };

const body: CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.62,
  color: ink,
  whiteSpace: 'pre-wrap',
};
const isFirst = ({ node, parent }: Props) => parent?.content?.[0] === node;
const inside = (props: Props, ...types: string[]) =>
  types.includes(String(props.parent?.type));

/** One heading style per level; the first block of the pages sits flush. */
const headings: Record<number, CSSProperties> = {
  1: {
    fontSize: 19,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
    margin: '30px 0 12px',
  },
  2: { fontSize: 14, lineHeight: 1.3, margin: '24px 0 8px' },
  3: { fontSize: 11.5, lineHeight: 1.4, margin: '16px 0 4px' },
};

function List({ node, renderElement, ordered }: Props & { ordered: boolean }) {
  const start = Number(node.attrs?.start ?? 1);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        margin: '0 0 10px',
        maxWidth: measure,
      }}
    >
      {(node.content ?? []).map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a printed list never reorders, and its items have no identity of their own.
        <div key={index} style={{ display: 'flex', breakInside: 'avoid' }}>
          <span style={{ ...body, width: 20, flexShrink: 0, color: soft }}>
            {ordered ? `${start + index}.` : '•'}
          </span>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {renderElement({ content: item, parent: node })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Table({ node, renderElement }: Props) {
  const rows = node.content ?? [];
  // A first row of header cells repeats on every page the table runs onto.
  const headed = rows[0]?.content?.every((cell) => cell.type === 'tableHeader');
  const [head, ...rest] = rows;
  const render = (row: JSONNodeType, index: number) => (
    <tr key={index} style={{ breakInside: 'avoid' }}>
      {renderElement({ content: row, parent: node })}
    </tr>
  );
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        margin: '6px 0 16px',
      }}
    >
      {headed && head && <thead>{render(head, 0)}</thead>}
      <tbody>{(headed ? rest : rows).map(render)}</tbody>
    </table>
  );
}

function Cell({ node, children, header }: Props & { header: boolean }) {
  const span = {
    colSpan: Number(node.attrs?.colspan ?? 1),
    rowSpan: Number(node.attrs?.rowspan ?? 1),
  };
  return header ? (
    <th
      {...span}
      style={{
        ...label,
        textAlign: 'left',
        padding: '0 14px 8px 0',
        borderBottom: `1px solid ${ruleStrong}`,
      }}
    >
      {children}
    </th>
  ) : (
    <td
      {...span}
      style={{
        padding: '9px 14px 9px 0',
        verticalAlign: 'top',
        borderBottom: `1px solid ${rule}`,
      }}
    >
      {children}
    </td>
  );
}

function Clause({ node, language }: Props & { language: Language }) {
  const found = clauseVersion(
    String(node.attrs?.id ?? ''),
    Number(node.attrs?.version ?? 1),
  );
  // Pages are decoded before they render, so a missing clause is a defect.
  if (!found)
    throw new Error(`Clause ${String(node.attrs?.id)} is not published.`);
  const text = found.text[language];
  return (
    <div
      style={{ margin: '0 0 14px', maxWidth: measure, breakInside: 'avoid' }}
    >
      <p style={{ ...body, fontWeight: 600, margin: '0 0 2px' }}>
        {text.title}
      </p>
      {pagesBody(markdownToJSON(text.body), language)}
      <p style={{ fontSize: 9, lineHeight: 1.5, color: faint, marginTop: 2 }}>
        {found.source}
      </p>
    </div>
  );
}

function mappings(language: Language) {
  const nodes: Record<string, (props: Props) => ReactNode> = {
    doc: ({ children }) => <>{children}</>,
    text: ({ node }) => node.text ?? '',
    hardBreak: () => '\n',
    paragraph: (props) => {
      const tight = inside(
        props,
        'listItem',
        'tableCell',
        'tableHeader',
        'blockquote',
      );
      // An empty paragraph is a deliberate gap, one line tall.
      if (!props.node.content?.length)
        return <div style={{ height: tight ? 0 : 12 }} />;
      return (
        <p
          style={{
            ...body,
            ...(inside(props, 'tableHeader')
              ? { fontSize: 'inherit', color: 'inherit' }
              : {}),
            ...(inside(props, 'tableCell') ? { fontSize: 11 } : {}),
            margin: tight ? 0 : '0 0 9px',
            maxWidth: tight ? undefined : measure,
          }}
        >
          {props.children}
        </p>
      );
    },
    heading: (props) => {
      const level = Number(props.node.attrs?.level ?? 1);
      const style = headings[level] ?? headings[3];
      const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      return (
        <Tag
          style={{
            ...style,
            fontWeight: 600,
            color: ink,
            maxWidth: measure,
            ...(isFirst(props) ? { marginTop: 0 } : {}),
          }}
        >
          {props.children}
        </Tag>
      );
    },
    bulletList: (props) => <List {...props} ordered={false} />,
    orderedList: (props) => <List {...props} ordered />,
    listItem: ({ children }) => <>{children}</>,
    blockquote: ({ children }) => (
      <div
        style={{
          borderLeft: `2px solid ${ruleStrong}`,
          padding: '1px 0 1px 14px',
          margin: '4px 0 14px',
          maxWidth: measure,
          color: soft,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {children}
      </div>
    ),
    horizontalRule: () => (
      <div style={{ height: 1, background: rule, margin: '20px 0' }} />
    ),
    pageBreak: () => <div style={{ breakAfter: 'page' }} />,
    table: (props) => <Table {...props} />,
    tableRow: ({ children }) => <>{children}</>,
    tableHeader: (props) => <Cell {...props} header />,
    tableCell: (props) => <Cell {...props} header={false} />,
    clause: (props) => <Clause {...props} language={language} />,
  };
  const marks: Record<string, (props: MarkProps) => ReactNode> = {
    bold: ({ children }) => <span style={{ fontWeight: 600 }}>{children}</span>,
    italic: ({ children }) => (
      <span style={{ fontStyle: 'italic' }}>{children}</span>
    ),
    underline: ({ children }) => (
      <span style={{ textDecoration: 'underline' }}>{children}</span>
    ),
    link: ({ mark, children }) => (
      <a
        href={String(mark.attrs?.href ?? '')}
        style={{ color: ink, textDecoration: 'underline' }}
      >
        {children}
      </a>
    ),
  };
  return { nodes, marks };
}

/** The node and mark names the renderer prints; a test holds it to the page schema. */
export const renderedTypes = (() => {
  const { nodes, marks } = mappings('en');
  return { nodes: Object.keys(nodes), marks: Object.keys(marks) };
})();

/** Tiptap's JSON, with the keys it left undefined dropped, as the renderer types a node. */
function renderable(content: JSONContent): JSONNodeType {
  return {
    ...(content.type === undefined ? {} : { type: content.type }),
    ...(content.attrs ? { attrs: content.attrs } : {}),
    ...(content.content ? { content: content.content.map(renderable) } : {}),
    ...(content.marks
      ? {
          marks: content.marks.map((mark) => ({
            type: mark.type,
            ...(mark.attrs ? { attrs: mark.attrs } : {}),
          })),
        }
      : {}),
    ...(content.text === undefined ? {} : { text: content.text }),
  };
}

function pagesBody(content: JSONContent, language: Language): ReactNode {
  const { nodes, marks } = mappings(language);
  return renderJSONContentToReactElement({
    nodeMapping: nodes,
    markMapping: marks,
  })({
    content: renderable(content),
  });
}

function Notices({
  data,
  quote,
  language,
}: {
  data: InvoiceData;
  quote: QuoteTerms;
  language: Language;
}) {
  const t = documentLabels[language];
  return (
    <section
      style={{ display: 'flex', flexDirection: 'column', marginTop: 36 }}
    >
      <h2
        style={{
          ...label,
          margin: '0 0 14px',
          paddingBottom: 9,
          borderBottom: `1px solid ${ruleStrong}`,
        }}
      >
        {t.legal}
      </h2>
      {quoteNotices(data, quote, language).map((notice) => (
        <div
          key={notice.id}
          style={{
            maxWidth: measure,
            margin: '0 0 12px',
            breakInside: 'avoid',
          }}
        >
          <p
            style={{
              fontSize: 10.5,
              lineHeight: 1.55,
              fontWeight: 600,
              color: ink,
            }}
          >
            {notice.title}
          </p>
          <p style={{ fontSize: 10.5, lineHeight: 1.55, color: soft }}>
            {notice.body}
          </p>
          <p
            style={{
              fontSize: 8.5,
              lineHeight: 1.5,
              color: faint,
              marginTop: 2,
            }}
          >
            {notice.source}
          </p>
        </div>
      ))}
    </section>
  );
}

/** The model form of annex B, with the trader's details filled in. */
function WithdrawalForm({
  data,
  reference,
  language,
}: {
  data: InvoiceData;
  reference: string;
  language: Language;
}) {
  const t = documentLabels[language];
  const es = language === 'es';
  const trader = [
    data.issuer.name,
    ...partyLines(data.issuer, {
      home: data.issuer.address.country,
      language,
      taxLabel: t.taxId,
    }),
  ]
    .filter(Boolean)
    .join(', ');
  const blanks = es
    ? [
        'Aceptado el',
        'Nombre del consumidor',
        'Domicilio del consumidor',
        'Firma del consumidor (solo si el formulario se presenta en papel)',
        'Fecha',
      ]
    : [
        'Accepted on',
        'Name of consumer',
        'Address of consumer',
        'Signature of consumer (only if this form is notified on paper)',
        'Date',
      ];
  return (
    <section
      style={{
        breakBefore: 'page',
        maxWidth: measure,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>
        {t.withdrawalForm}
      </h2>
      <p style={{ ...body, fontSize: 10.5, color: soft, margin: '0 0 22px' }}>
        {es
          ? '(Solo debe cumplimentar y enviar este formulario si desea desistir del contrato)'
          : '(Complete and return this form only if you wish to withdraw from the contract)'}
      </p>
      <p style={{ ...body, margin: '0 0 12px' }}>
        {es ? 'A la atención de ' : 'To '}
        {trader}:
      </p>
      <p style={{ ...body, margin: '0 0 26px' }}>
        {es
          ? `Por la presente le comunico que desisto de mi contrato de prestación del siguiente servicio: ${reference}.`
          : `I hereby give notice that I withdraw from my contract for the provision of the following service: ${reference}.`}
      </p>
      {blanks.map((blank) => (
        <div
          key={blank}
          style={{
            display: 'flex',
            flexDirection: 'column',
            margin: '0 0 22px',
          }}
        >
          <div
            style={{ height: 22, borderBottom: `1px solid ${ruleStrong}` }}
          />
          <p style={{ fontSize: 9, color: faint, marginTop: 5 }}>{blank}</p>
        </div>
      ))}
    </section>
  );
}

/** Everything a quote prints after its priced lines. */
export function QuoteAppendix({
  data,
  quote,
  number,
  language,
}: {
  data: InvoiceData;
  quote: QuoteTerms;
  number: string | null;
  language: Language;
}) {
  const t = documentLabels[language];
  const reference = [data.title, number ?? t.draft].filter(Boolean).join(', ');
  return (
    <>
      {hasPages(quote.pages) && (
        <section
          style={{
            breakBefore: 'page',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {pagesBody(toJSONContent(readPages(quote.pages)), language)}
        </section>
      )}
      <Notices data={data} quote={quote} language={language} />
      {printsWithdrawalForm(data) && (
        <WithdrawalForm data={data} reference={reference} language={language} />
      )}
    </>
  );
}
