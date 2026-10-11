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
  grid,
  ink,
  label,
  rule,
  ruleStrong,
  soft,
  text,
} from './pdf-style';
import { printsWithdrawalForm, quoteNotices } from './quote-notices';

// A quote's pages, notices and withdrawal form as the PDF prints them, set
// the way a printed proposal or contract is: a title and its lede, then
// sections whose headings hang in a margin column beside their text, each
// opened by a fine rule. Clauses and legal notices are numbered articles
// with run-in titles and their legal source as an italic citation, so the
// conditions read as terms someone wrote, not as text pasted in.

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
  fontSize: 12,
  lineHeight: 1.58,
  color: text,
  whiteSpace: 'pre-wrap',
};
const inside = (props: Props, ...types: string[]) =>
  types.includes(String(props.parent?.type));

/** A citation of the law a clause or notice follows. */
const citation: CSSProperties = {
  fontSize: 9.5,
  lineHeight: 1.5,
  fontStyle: 'italic',
  color: faint,
  marginTop: 3,
};

/** A hanging number: the text of every article starts on one edge. */
function Numbered({
  n,
  size,
  children,
}: {
  n: number;
  size: number;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', breakInside: 'avoid' }}>
      <span
        style={{
          width: 22,
          flexShrink: 0,
          fontSize: size,
          lineHeight: 1.58,
          color: faint,
        }}
      >
        {n}.
      </span>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

function List({ node, renderElement, ordered }: Props & { ordered: boolean }) {
  const start = Number(node.attrs?.start ?? 1);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        margin: '2px 0 12px',
      }}
    >
      {(node.content ?? []).map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a printed list never reorders, and its items have no identity of their own.
        <div key={index} style={{ display: 'flex', breakInside: 'avoid' }}>
          <span style={{ ...body, width: 22, flexShrink: 0, color: faint }}>
            {ordered ? `${start + index}.` : '–'}
          </span>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
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
        margin: '8px 0 18px',
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

/**
 * A paragraph tree with `title` run in at the start of its first
 * paragraph, in bold: "Revisions. Each deliverable includes…".
 */
function runIn(content: JSONContent, title: string): JSONContent {
  const [first, ...rest] = content.content ?? [];
  const lead = { type: 'text', text: `${title}. `, marks: [{ type: 'bold' }] };
  if (first?.type !== 'paragraph')
    return {
      ...content,
      content: [
        { type: 'paragraph', content: [lead] },
        ...(content.content ?? []),
      ],
    };
  return {
    ...content,
    content: [{ ...first, content: [lead, ...(first.content ?? [])] }, ...rest],
  };
}

function Clause({ node, language }: Props & { language: Language }) {
  const found = clauseVersion(
    String(node.attrs?.id ?? ''),
    Number(node.attrs?.version ?? 1),
  );
  // Pages are decoded before they render, so a missing clause is a defect.
  if (!found)
    throw new Error(`Clause ${String(node.attrs?.id)} is not published.`);
  const words = found.text[language];
  return (
    <div style={{ margin: '0 0 12px' }}>
      <Numbered n={Number(node.attrs?.n ?? 1)} size={12}>
        {pagesBody(runIn(markdownToJSON(words.body), words.title), language, {
          tight: true,
        })}
        <p style={citation}>{found.source}</p>
      </Numbered>
    </div>
  );
}

function mappings(
  language: Language,
  options: { tight?: boolean; lede?: boolean } = {},
) {
  const nodes: Record<string, (props: Props) => ReactNode> = {
    doc: ({ children }) => <>{children}</>,
    text: ({ node }) => node.text ?? '',
    hardBreak: () => '\n',
    paragraph: (props) => {
      const tight =
        options.tight ||
        inside(props, 'listItem', 'tableCell', 'tableHeader', 'blockquote');
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
            ...(inside(props, 'tableCell') ? { fontSize: 11.5 } : {}),
            ...(inside(props, 'blockquote') ? { color: soft } : {}),
            ...(options.lede
              ? { fontSize: 'inherit', lineHeight: 'inherit', color: 'inherit' }
              : {}),
            margin: tight || options.lede ? 0 : '0 0 10px',
          }}
        >
          {props.children}
        </p>
      );
    },
    // Top-level headings are placed by the section grid; this mapping sets
    // the ones that sit inside a section's text.
    heading: (props) => (
      <h3
        style={{
          fontSize: 12,
          lineHeight: 1.45,
          fontWeight: 600,
          color: ink,
          margin: '14px 0 4px',
        }}
      >
        {props.children}
      </h3>
    ),
    bulletList: (props) => <List {...props} ordered={false} />,
    orderedList: (props) => <List {...props} ordered />,
    listItem: ({ children }) => <>{children}</>,
    // A quotation sits indented and in italic, the way a printed page sets
    // an aside; a coloured rule beside it is a screen habit.
    blockquote: ({ children }) => (
      <div
        style={{
          margin: '2px 0 14px',
          fontStyle: 'italic',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {children}
      </div>
    ),
    horizontalRule: () => (
      <div style={{ height: 1, background: rule, margin: '18px 0' }} />
    ),
    pageBreak: () => <div style={{ breakAfter: 'page' }} />,
    table: (props) => <Table {...props} />,
    tableRow: ({ children }) => <>{children}</>,
    tableHeader: (props) => <Cell {...props} header />,
    tableCell: (props) => <Cell {...props} header={false} />,
    clause: (props) => <Clause {...props} language={language} />,
  };
  const marks: Record<string, (props: MarkProps) => ReactNode> = {
    bold: ({ children }) => (
      <span style={{ fontWeight: 600, color: ink }}>{children}</span>
    ),
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

function pagesBody(
  content: JSONContent,
  language: Language,
  options: { tight?: boolean; lede?: boolean } = {},
): ReactNode {
  const { nodes, marks } = mappings(language, options);
  return renderJSONContentToReactElement({
    nodeMapping: nodes,
    markMapping: marks,
  })({
    content: renderable(content),
  });
}

/**
 * One row of the grid: a heading in the margin, its text beside it, under a
 * fine rule. The first row of a run sits flush, with no rule above it.
 */
function Row({
  aside,
  first = false,
  children,
}: {
  aside?: ReactNode;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: grid.gutter,
        ...(first
          ? {}
          : {
              marginTop: 22,
              paddingTop: 16,
              borderTop: `1px solid ${rule}`,
            }),
      }}
    >
      <div style={{ width: grid.aside, flexShrink: 0 }}>{aside}</div>
      <div
        style={{ width: grid.text, display: 'flex', flexDirection: 'column' }}
      >
        {children}
      </div>
    </div>
  );
}

/** A heading in the margin, on the first line of the text beside it. */
const asideHeading: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.58,
  fontWeight: 600,
  color: ink,
  letterSpacing: '-0.005em',
};

interface Section {
  readonly heading: JSONContent | null;
  readonly blocks: JSONContent[];
}

/**
 * The pages as a title, its lede, and sections. A level-1 heading is the
 * title, the paragraph straight after it the lede, and each level-2
 * heading opens a section; a page break ends one. Clauses are numbered
 * within their section.
 */
function layout(doc: JSONContent) {
  const nodes = doc.content ?? [];
  let index = 0;
  let title: JSONContent | null = null;
  let lede: JSONContent | null = null;
  if (nodes[0]?.type === 'heading' && nodes[0].attrs?.level === 1) {
    title = nodes[0];
    index = 1;
    if (nodes[1]?.type === 'paragraph' && nodes[1].content?.length) {
      lede = nodes[1];
      index = 2;
    }
  }
  const parts: (Section | 'break')[] = [];
  let current: Section | null = null;
  let clause = 0;
  for (const node of nodes.slice(index)) {
    if (node.type === 'pageBreak') {
      parts.push('break');
      current = null;
      continue;
    }
    if (node.type === 'heading' && Number(node.attrs?.level) <= 2) {
      current = { heading: node, blocks: [] };
      parts.push(current);
      clause = 0;
      continue;
    }
    if (!current) {
      current = { heading: null, blocks: [] };
      parts.push(current);
    }
    current.blocks.push(
      node.type === 'clause'
        ? { ...node, attrs: { ...node.attrs, n: ++clause } }
        : node,
    );
  }
  return { title, lede, parts };
}

const inlineText = (node: JSONContent): string =>
  node.text ?? (node.content ?? []).map(inlineText).join('');

function PagesBody({
  pages,
  language,
}: {
  pages: JSONContent;
  language: Language;
}) {
  const { title, lede, parts } = layout(pages);
  let first = true;
  return (
    <section
      style={{ breakBefore: 'page', display: 'flex', flexDirection: 'column' }}
    >
      {title && (
        <div style={{ marginLeft: grid.aside + grid.gutter, width: grid.text }}>
          <h1
            style={{
              fontSize: 27,
              lineHeight: 1.12,
              letterSpacing: '-0.022em',
              fontWeight: 600,
              color: ink,
              margin: `0 0 ${lede ? 14 : 30}px`,
            }}
          >
            {inlineText(title)}
          </h1>
          {lede && (
            <div
              style={{
                fontSize: 14.5,
                lineHeight: 1.5,
                color: ink,
                letterSpacing: '-0.005em',
                marginBottom: 30,
              }}
            >
              {pagesBody({ type: 'doc', content: [lede] }, language, {
                lede: true,
              })}
            </div>
          )}
        </div>
      )}
      {parts.map((part, index) => {
        if (part === 'break') {
          first = true;
          // biome-ignore lint/suspicious/noArrayIndexKey: printed sections never reorder.
          return <div key={index} style={{ breakAfter: 'page' }} />;
        }
        const row = (
          <Row
            // biome-ignore lint/suspicious/noArrayIndexKey: printed sections never reorder.
            key={index}
            first={first && !title}
            aside={
              part.heading && (
                <h2 style={asideHeading}>{inlineText(part.heading)}</h2>
              )
            }
          >
            {pagesBody({ type: 'doc', content: part.blocks }, language)}
          </Row>
        );
        first = false;
        return row;
      })}
    </section>
  );
}

/** A page's title and lede, set on the text column. */
function Title({ title, lede }: { title: string; lede?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginLeft: grid.aside + grid.gutter,
        width: grid.text,
        marginBottom: 30,
      }}
    >
      <h1
        style={{
          fontSize: 27,
          lineHeight: 1.12,
          letterSpacing: '-0.022em',
          fontWeight: 600,
          color: ink,
          margin: lede ? '0 0 14px' : 0,
        }}
      >
        {title}
      </h1>
      {lede && (
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.5,
            letterSpacing: '-0.005em',
            color: ink,
          }}
        >
          {lede}
        </p>
      )}
    </div>
  );
}

/**
 * The notices the law asks for, on a page of their own after the
 * proposal, as a contract sets its general terms: each one a row, its
 * subject in the margin, its source cited under it.
 */
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
      style={{ breakBefore: 'page', display: 'flex', flexDirection: 'column' }}
    >
      <Title title={t.legal} lede={t.legalLede} />
      {quoteNotices(data, quote, language).map((notice, index) => (
        <div key={notice.id} style={{ breakInside: 'avoid' }}>
          <Row
            first={index === 0}
            aside={<h2 style={asideHeading}>{notice.title}</h2>}
          >
            <p style={{ ...body, fontSize: 11.5 }}>{notice.body}</p>
            <p style={citation}>{notice.source}</p>
          </Row>
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
  // A blank's label sits on the line it names, so the row aligns to its foot.
  const field = (aside: string, content: ReactNode, blank = false) => (
    <div
      style={{
        display: 'flex',
        alignItems: blank ? 'flex-end' : 'flex-start',
        gap: grid.gutter,
        marginBottom: 18,
      }}
    >
      <p
        style={{
          ...asideHeading,
          width: grid.aside,
          flexShrink: 0,
          fontWeight: 500,
          color: soft,
          ...(blank ? { fontSize: 11, lineHeight: 1.4, paddingBottom: 3 } : {}),
        }}
      >
        {aside}
      </p>
      <div style={{ width: grid.text }}>{content}</div>
    </div>
  );
  return (
    <section
      style={{ breakBefore: 'page', display: 'flex', flexDirection: 'column' }}
    >
      <Title
        title={t.withdrawalForm}
        lede={
          es
            ? 'Solo debe cumplimentarlo y enviarlo si desea desistir del contrato.'
            : 'Complete and return it only if you wish to withdraw from the contract.'
        }
      />
      {field(es ? 'A la atención de' : 'To', <p style={body}>{trader}</p>)}
      {field(
        es ? 'Comunicación' : 'Notice',
        <p style={body}>
          {es
            ? `Por la presente le comunico que desisto de mi contrato de prestación del siguiente servicio: ${reference}.`
            : `I hereby give notice that I withdraw from my contract for the provision of the following service: ${reference}.`}
        </p>,
      )}
      <div style={{ height: 14 }} />
      {blanks.map((blank) => (
        <div key={blank}>
          {field(
            blank,
            <div
              style={{ height: 30, borderBottom: `1px solid ${ruleStrong}` }}
            />,
            true,
          )}
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
        <PagesBody
          pages={toJSONContent(readPages(quote.pages))}
          language={language}
        />
      )}
      <Notices data={data} quote={quote} language={language} />
      {printsWithdrawalForm(data) && (
        <WithdrawalForm data={data} reference={reference} language={language} />
      )}
    </>
  );
}
