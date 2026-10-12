import type { ReactNode } from 'react';
import { Column, Img, Row, Section, Text } from 'react-email';
import { text, tone } from './frame';

// The quote's ticket, as the customer's page draws it, built from what a
// mail client keeps: a white face, a perforation with a notch cut into each
// edge, and the slip below it a shade off the white. The notches are cells
// of the canvas colour rounded on their inner side.

const notch = (side: 'left' | 'right') => (
  <Column
    style={{
      width: 12,
      height: 24,
      backgroundColor: tone.canvas,
      border: `1px solid ${tone.edge}`,
      ...(side === 'left'
        ? { borderLeft: 0, borderRadius: '0 12px 12px 0' }
        : { borderRight: 0, borderRadius: '12px 0 0 12px' }),
    }}
  />
);

export function Ticket({ face, slip }: { face: ReactNode; slip: ReactNode }) {
  return (
    <>
      <Section
        style={{
          padding: '28px 32px 22px',
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${tone.edge}`,
          borderBottom: 0,
          backgroundColor: tone.paper,
        }}
      >
        {face}
      </Section>
      <Section style={{ backgroundColor: tone.stub }}>
        <Row>
          {notch('left')}
          <Column style={{ padding: '0 10px' }}>
            <div style={{ borderTop: `1px dashed ${tone.dash}` }} />
          </Column>
          {notch('right')}
        </Row>
      </Section>
      <Section
        style={{
          padding: '18px 32px 30px',
          borderRadius: '0 0 20px 20px',
          border: `1px solid ${tone.edge}`,
          borderTop: 0,
          backgroundColor: tone.stub,
        }}
      >
        {slip}
      </Section>
    </>
  );
}

/** The ticket's face: what the quote is, what it costs, where it stands. */
export function Face({
  kicker,
  title,
  totalLabel,
  total,
  status,
  done,
}: {
  kicker: string;
  title: string;
  totalLabel: string;
  total: string;
  status: string;
  /** Accepted: the status takes the paid green. */
  done: boolean;
}) {
  return (
    <>
      <Text style={text.small}>{kicker}</Text>
      {title && (
        <Text
          style={{
            margin: '2px 0 0',
            fontSize: 16,
            lineHeight: '22px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: tone.ink,
          }}
        >
          {title}
        </Text>
      )}
      <Text style={{ ...text.small, marginTop: 20 }}>{totalLabel}</Text>
      <Text
        style={{
          margin: '2px 0 0',
          fontSize: 34,
          lineHeight: '40px',
          fontWeight: 600,
          letterSpacing: '-0.025em',
          fontVariantNumeric: 'tabular-nums',
          color: tone.ink,
        }}
      >
        {total}
      </Text>
      <Text
        style={{
          ...text.small,
          marginTop: 4,
          color: done ? tone.done : tone.ink2,
        }}
      >
        {status}
      </Text>
    </>
  );
}

/** A signature on its line, the signer's name and the day printed under it. */
export function Signed({
  src,
  alt,
  width,
  height,
  name,
  day,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  name: string;
  day: string;
}) {
  return (
    <Section
      style={{
        margin: '6px 0 22px',
        padding: '14px 18px 12px',
        borderRadius: 14,
        border: `1px solid ${tone.edge}`,
        backgroundColor: tone.paper,
      }}
    >
      <Img
        src={src}
        alt={alt}
        width={width}
        height={height}
        style={{ display: 'block', margin: '0 0 -4px' }}
      />
      <div style={{ borderTop: `1px solid ${tone.dash}` }} />
      <Row style={{ marginTop: 8 }}>
        <Column>
          <Text style={{ ...text.small, color: tone.ink, fontWeight: 500 }}>
            {name}
          </Text>
        </Column>
        <Column align="right">
          <Text style={text.small}>{day}</Text>
        </Column>
      </Row>
    </Section>
  );
}
