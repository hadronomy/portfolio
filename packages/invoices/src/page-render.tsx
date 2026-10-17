import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import type { JSONContent } from '@tiptap/core';
import {
  type JSONMarkType,
  type JSONNodeType,
  renderJSONContentToReactElement,
} from '@tiptap/static-renderer/json/react';
import type { CSSProperties, ReactNode } from 'react';
import { planTerms } from '#billing';
import { clauseVersion } from '#clauses';
import type { InvoiceData, Language, QuoteTerms } from '#model';
import { markdownToJSON } from '#page-markdown';
import { hasPages, readPages, toJSONContent } from '#pages';
import { partyLines } from '#party-lines';
import {
  faint,
  grid,
  ink,
  label,
  rule,
  ruleStrong,
  soft,
  text,
} from '#pdf-style';
import { type QuoteResponse, signatureSource } from '#quote-model';
import { printsWithdrawalForm, quoteNotices } from '#quote-notices';

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
  // A list split to keep its first items with their heading prints as one:
  // the head has no space below, the tail only the gap between items.
  const split = node.attrs?.split;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        margin:
          split === 'head'
            ? '2px 0 0'
            : split === 'tail'
              ? '5px 0 12px'
              : '2px 0 12px',
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
      // An amount or a quantity in a table reads as one token: "288,00 €"
      // must not leave its sign on the next line.
      const figure =
        inside(props, 'tableCell', 'tableHeader') &&
        isFigure(inlineText(props.node as JSONContent));
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
            ...(figure
              ? { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
              : {}),
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

type Part =
  | { readonly kind: 'part'; readonly title: JSONContent }
  | ({ readonly kind: 'section' } & Section)
  | { readonly kind: 'break' };

/**
 * The pages as a title, its lede, and parts. The first level-1 heading is
 * the title and the paragraph straight after it the lede; a later level-1
 * heading opens a part, each level-2 heading a section, and a page break
 * ends one. Clauses are numbered through the whole document, the way a
 * contract counts its articles.
 */
export function layout(doc: JSONContent) {
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
  const parts: Part[] = [];
  let current: (Section & { kind: 'section' }) | null = null;
  let clause = 0;
  for (const node of nodes.slice(index)) {
    if (node.type === 'pageBreak') {
      parts.push({ kind: 'break' });
      current = null;
      continue;
    }
    const level = Number(node.attrs?.level);
    if (node.type === 'heading' && level === 1) {
      parts.push({ kind: 'part', title: node });
      current = null;
      continue;
    }
    if (node.type === 'heading' && level === 2) {
      current = { kind: 'section', heading: node, blocks: [] };
      parts.push(current);
      continue;
    }
    if (!current) {
      current = { kind: 'section', heading: null, blocks: [] };
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

/** An amount, a quantity or a percentage: digits with their separators and sign. */
export const isFigure = (value: string) =>
  /^[-−+]?[\d.,\s\u00a0]*\d[\d.,\s\u00a0]*\s?(€|\$|%|£)?$/.test(value.trim());

// The margin column holds about two lines of a heading. A run of sections
// where any heading needs more sets every heading of the run over its
// text instead, so the run reads one way down the page.
const marginHeading = 36;

/** "S01 · Discovery": a short code the margin can hold, and the name. */
const coded = (heading: string) =>
  /^(\S{1,6})\s+[·•\-–—:]\s+(.+)$/.exec(heading);

/** One short paragraph: a run of these is a list, and sits closer. */
const isShort = (section: Section) =>
  section.blocks.length === 1 &&
  section.blocks[0]?.type === 'paragraph' &&
  inlineText(section.blocks[0]).length < 400;

/**
 * The first block of a section and the rest. The first block travels with
 * the heading, so a heading never ends a page alone: a paragraph whole,
 * a list by its first two items. A table breaks between its own rows.
 */
export function lead(
  blocks: readonly JSONContent[],
): [JSONContent[], JSONContent[]] {
  const [first, ...rest] = blocks;
  if (!first || first.type === 'table') return [[], [...blocks]];
  const items = first.content ?? [];
  if (
    (first.type === 'bulletList' || first.type === 'orderedList') &&
    items.length > 2
  ) {
    const start = Number(first.attrs?.start ?? 1);
    return [
      [
        {
          ...first,
          attrs: { ...first.attrs, split: 'head' },
          content: items.slice(0, 2),
        },
      ],
      [
        {
          ...first,
          attrs: { ...first.attrs, split: 'tail', start: start + 2 },
          content: items.slice(2),
        },
        ...rest,
      ],
    ];
  }
  return [[first], rest];
}

/**
 * The end of a section's text, split off when it would otherwise strand:
 * a short closing paragraph keeps the last two items of the list before
 * it, so a page never opens on two lines under a finished list.
 */
export function tail(
  blocks: readonly JSONContent[],
): [JSONContent[], JSONContent[]] {
  const last = blocks.at(-1);
  const before = blocks.at(-2);
  const items = before?.content ?? [];
  if (
    last?.type !== 'paragraph' ||
    inlineText(last).length > 320 ||
    (before?.type !== 'bulletList' && before?.type !== 'orderedList') ||
    items.length < 3
  )
    return [[...blocks], []];
  const start = Number(before.attrs?.start ?? 1);
  // A list already split from its head keeps its own spacing above.
  const split = before.attrs?.split === 'tail' ? 'tail' : 'head';
  return [
    [
      ...blocks.slice(0, -2),
      {
        ...before,
        attrs: { ...before.attrs, split },
        content: items.slice(0, -2),
      },
    ],
    [
      {
        ...before,
        attrs: {
          ...before.attrs,
          split: 'tail',
          start: start + items.length - 2,
        },
        content: items.slice(-2),
      },
      last,
    ],
  ];
}

/**
 * Where a section's heading prints: in the margin, or, in a run whose
 * headings are too long for it, over its text with any code in the margin.
 */
function headingParts(
  heading: string,
  stacked: boolean,
): { aside: ReactNode; over: ReactNode } {
  if (!heading) return { aside: null, over: null };
  if (!stacked)
    return { aside: <h2 style={asideHeading}>{heading}</h2>, over: null };
  const code = coded(heading);
  return {
    aside: code && (
      <span
        style={{
          ...asideHeading,
          color: soft,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {code[1]}
      </span>
    ),
    over: (
      <h2 style={{ ...asideHeading, marginBottom: 3 }}>
        {code ? code[2] : heading}
      </h2>
    ),
  };
}

/** A part's title, on the text column like the document's own. */
const partTitle: CSSProperties = {
  fontSize: 18,
  lineHeight: 1.2,
  letterSpacing: '-0.015em',
  fontWeight: 600,
  color: ink,
};

function PagesBody({
  pages,
  language,
}: {
  pages: JSONContent;
  language: Language;
}) {
  const { title, lede, parts } = layout(pages);
  // Each run of sections between parts and breaks sets its headings one way.
  const stacked = new Set<number>();
  let run: number[] = [];
  const close = () => {
    if (
      run.some((at) => {
        const part = parts[at];
        return (
          part?.kind === 'section' &&
          part.heading &&
          inlineText(part.heading).length > marginHeading
        );
      })
    )
      for (const at of run) stacked.add(at);
    run = [];
  };
  parts.forEach((part, at) => {
    if (part.kind === 'section') run.push(at);
    else close();
  });
  close();

  const units: ReactNode[] = [];
  // Whether the next row opens a page or a part: it then sits flush.
  let flush = !title;
  let pendingTitle: ReactNode = null;
  parts.forEach((part, at) => {
    if (part.kind === 'break') {
      // biome-ignore lint/suspicious/noArrayIndexKey: printed sections never reorder.
      units.push(<div key={at} style={{ breakAfter: 'page' }} />);
      flush = true;
      return;
    }
    if (part.kind === 'part') {
      pendingTitle = (
        <h2
          style={{
            ...partTitle,
            marginLeft: grid.aside + grid.gutter,
            width: grid.text,
            margin: `${flush ? 0 : 40}px 0 18px ${grid.aside + grid.gutter}px`,
          }}
        >
          {inlineText(part.title)}
        </h2>
      );
      flush = true;
      return;
    }
    const previous = parts[at - 1];
    const tight =
      !flush &&
      isShort(part) &&
      previous?.kind === 'section' &&
      isShort(previous);
    const spacing: CSSProperties = flush
      ? {}
      : {
          marginTop: tight ? 10 : 22,
          paddingTop: tight ? 12 : 16,
          borderTop: `1px solid ${rule}`,
        };
    const heading = part.heading ? inlineText(part.heading) : '';
    const { aside, over } = headingParts(heading, stacked.has(at));
    const [head, rest] = lead(part.blocks);
    const [body, end] = tail(rest);
    units.push(
      // biome-ignore lint/suspicious/noArrayIndexKey: printed sections never reorder.
      <div key={at} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* The title of a part travels with its first row, the heading of a
            row with its first lines: neither ends a page alone. */}
        <div
          style={{
            breakInside: 'avoid',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {pendingTitle}
          <div style={{ display: 'flex', gap: grid.gutter, ...spacing }}>
            <div style={{ width: grid.aside, flexShrink: 0 }}>{aside}</div>
            <div
              style={{
                width: grid.text,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {over}
              {head.length > 0 &&
                pagesBody({ type: 'doc', content: head }, language)}
            </div>
          </div>
        </div>
        {[body, end].map(
          (blocks, piece) =>
            blocks.length > 0 && (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: the body and the end of one section, always in this order.
                key={piece}
                style={{
                  display: 'flex',
                  gap: grid.gutter,
                  ...(piece === 1 && { breakInside: 'avoid' }),
                }}
              >
                <div style={{ width: grid.aside, flexShrink: 0 }} />
                <div
                  style={{
                    width: grid.text,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {pagesBody({ type: 'doc', content: blocks }, language)}
                </div>
              </div>
            ),
        )}
      </div>,
    );
    pendingTitle = null;
    flush = false;
  });
  // A part with nothing after it still prints its title.
  if (pendingTitle) units.push(<div key="last-title">{pendingTitle}</div>);

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
      {units}
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
  const t = translate(language);
  return (
    <section
      style={{ breakBefore: 'page', display: 'flex', flexDirection: 'column' }}
    >
      <Title title={t(m.doc_legal)} lede={t(m.doc_legal_lede)} />
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
  const t = translate(language);
  const trader = [
    data.issuer.name,
    ...partyLines(data.issuer, {
      home: data.issuer.address.country,
      language,
      taxLabel: t(m.doc_tax_id),
    }),
  ]
    .filter(Boolean)
    .join(', ');
  const blanks = [
    t(m.withdrawal_accepted_on),
    t(m.withdrawal_name),
    t(m.withdrawal_address),
    t(m.withdrawal_signature),
    t(m.withdrawal_date),
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
      <Title title={t(m.doc_withdrawal_form)} lede={t(m.withdrawal_lede)} />
      {field(t(m.withdrawal_to), <p style={body}>{trader}</p>)}
      {field(
        t(m.withdrawal_notice_label),
        <p style={body}>{t(m.withdrawal_notice, { service: reference })}</p>,
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

/** The width and height a signature SVG declares, for its aspect. */
function signatureSize(svg: string) {
  const width = Number(svg.match(/ width="(\d+)"/)?.[1] ?? 0);
  const height = Number(svg.match(/ height="(\d+)"/)?.[1] ?? 0);
  return width > 0 && height > 0 ? { width, height } : { width: 5, height: 2 };
}

/**
 * The signed copy's last page: the signature the customer drew, on its
 * line over their name, then the record of the acceptance, row by row as
 * the notices are set. It names the fingerprint of the PDF they read, so
 * the copy carries the proof of which document the signature belongs to.
 */
export function Acceptance({
  data,
  acceptance,
  language,
}: {
  data: InvoiceData;
  acceptance: QuoteResponse;
  language: Language;
}) {
  const t = translate(language);
  const signature = acceptance.signature;
  // The ink sits at most 300 wide and 92 tall, at its own proportions.
  const size = signature ? signatureSize(signature) : null;
  const scale = size ? Math.min(300 / size.width, 92 / size.height) : 1;
  const value: CSSProperties = { ...body, color: ink };
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Title
        title={t(m.accept_title)}
        lede={t(m.accept_lede, {
          name: acceptance.name,
          decidedAt: acceptance.decidedAt,
        })}
      />
      {/* The label sits on the line it names, by the printed name. */}
      <Row
        first
        aside={
          <h2 style={{ ...asideHeading, paddingTop: 115 }}>
            {t(m.accept_signature)}
          </h2>
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 320,
            paddingTop: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              height: 100,
              paddingLeft: 6,
              borderBottom: `1px solid ${ruleStrong}`,
            }}
          >
            {signature && size && (
              <img
                src={signatureSource(signature)}
                alt={t(m.quote_signed_by, { name: acceptance.name })}
                style={{
                  width: size.width * scale,
                  height: size.height * scale,
                  marginBottom: -6,
                }}
              />
            )}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 7,
            }}
          >
            <p style={{ ...value, fontWeight: 600 }}>{acceptance.name}</p>
            <p style={{ ...body, color: soft }}>
              {t(m.date_document, { date: acceptance.decidedAt.slice(0, 10) })}
            </p>
          </div>
        </div>
      </Row>
      <Row aside={<h2 style={asideHeading}>{t(m.accept_signer)}</h2>}>
        <p style={value}>{acceptance.name}</p>
        <p style={{ ...body, color: soft }}>{acceptance.email}</p>
      </Row>
      <Row aside={<h2 style={asideHeading}>{t(m.accept_when)}</h2>}>
        <p style={value}>
          {t(m.accept_at, { decidedAt: acceptance.decidedAt })}
        </p>
      </Row>
      {acceptance.plan && (
        <Row aside={<h2 style={asideHeading}>{t(m.doc_plan)}</h2>}>
          <p style={value}>
            {acceptance.plan.name && (
              <span style={{ fontWeight: 600 }}>{acceptance.plan.name}. </span>
            )}
            {planTerms(acceptance.plan, language, data.currency)}
          </p>
        </Row>
      )}
      {data.customerType === 'consumer' && (
        <Row aside={<h2 style={asideHeading}>{t(m.accept_early)}</h2>}>
          <p style={value}>
            {t(acceptance.earlyStart ? m.accept_early_yes : m.accept_early_no)}
          </p>
        </Row>
      )}
      <Row aside={<h2 style={asideHeading}>{t(m.accept_document)}</h2>}>
        <p style={{ ...value, letterSpacing: '0.02em' }}>
          {acceptance.digest.slice(0, 32)}
        </p>
        <p style={{ ...value, letterSpacing: '0.02em' }}>
          {acceptance.digest.slice(32)}
        </p>
        <p style={{ ...citation, fontStyle: 'normal', marginTop: 6 }}>
          {t(m.accept_document_detail)}
        </p>
      </Row>
      <Row aside={<h2 style={asideHeading}>{t(m.accept_evidence)}</h2>}>
        <p style={{ ...body, fontSize: 11, color: soft }}>
          {t(m.accept_evidence_detail, {
            address: acceptance.address || '—',
            agent: acceptance.agent || '—',
          })}
        </p>
        <p style={citation}>
          Ley 34/2002, arts. 27 y 28; Reglamento (UE) 910/2014, art. 25.1
        </p>
      </Row>
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
  const t = translate(language);
  const reference = [data.title, number ?? t(m.doc_draft)]
    .filter(Boolean)
    .join(', ');
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
