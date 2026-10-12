import type { Locale } from '@portfolio/i18n';
import type { CSSProperties, ReactNode } from 'react';
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';

// What every invoice email stands on: the workspace's paper canvas, one
// column 480 wide, and a quiet foot. Mail clients drop most CSS, so the
// look lives in inline styles and tables, and every value here is one the
// clients that matter render: Apple Mail, Gmail and Outlook on the web.
// Outlook on Windows squares the corners and keeps the rest.

/** The invoice pages' palette, as plain values. */
export const tone = {
  canvas: '#f6f6f5',
  paper: '#ffffff',
  stub: '#fbfbfa',
  edge: '#e7e7e5',
  dash: '#d6d6d8',
  ink: '#141414',
  ink2: '#5d5d61',
  ink3: '#8e8e91',
  done: '#256b3c',
} as const;

export const font =
  "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export const text = {
  small: { margin: 0, fontSize: 13, lineHeight: '20px', color: tone.ink2 },
  body: { margin: 0, fontSize: 15, lineHeight: '23px', color: tone.ink },
  fine: { margin: 0, fontSize: 12, lineHeight: '18px', color: tone.ink3 },
} satisfies Record<string, CSSProperties>;

export function Frame({
  locale,
  preview,
  foot,
  children,
}: {
  locale: Locale;
  /** The line an inbox shows after the subject. */
  preview: string;
  /** Who sends it and why, under the card. */
  foot: ReactNode;
  children: ReactNode;
}) {
  return (
    <Html lang={locale}>
      <Head>
        {/* The card is light paper whatever the client's theme. */}
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: '40px 12px 48px',
          backgroundColor: tone.canvas,
          fontFamily: font,
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <Container style={{ width: '100%', maxWidth: 480 }}>
          {children}
          <Section style={{ padding: '24px 28px 0' }}>{foot}</Section>
        </Container>
      </Body>
    </Html>
  );
}

/** The foot's lines: quiet, and one link home at most. */
export function Foot({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <Text style={{ ...text.fine, textAlign: 'center' }}>
      {children}
      {href && label && (
        <>
          {' · '}
          <Link
            href={href}
            style={{ color: tone.ink3, textDecoration: 'underline' }}
          >
            {label}
          </Link>
        </>
      )}
    </Text>
  );
}
