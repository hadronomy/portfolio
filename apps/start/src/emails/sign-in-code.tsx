import { type Locale, translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { Column, Row, Section, Text } from 'react-email';
import { Foot, Frame, text, tone } from './_parts/frame';

// A customer's one-time code. The code is the whole message, so it stands
// alone on the card, one digit to a box as the page's code field draws it,
// and big enough to read across a room.

export interface SignInCodeProps {
  readonly locale: Locale;
  readonly code: string;
  /** Where the customer's account lives, for the foot. */
  readonly accountUrl: string;
}

export function SignInCode({ locale, code, accountUrl }: SignInCodeProps) {
  const t = translate(locale);
  return (
    <Frame
      locale={locale}
      preview={t(m.mail_code_expiry)}
      foot={
        <Foot href={accountUrl} label="hadronomy.com">
          {t(m.mail_code_why)}
        </Foot>
      }
    >
      <Section
        style={{
          padding: '36px 32px 34px',
          borderRadius: 20,
          border: `1px solid ${tone.edge}`,
          backgroundColor: tone.paper,
        }}
      >
        <Text
          style={{
            margin: 0,
            fontSize: 20,
            lineHeight: '26px',
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: tone.ink,
          }}
        >
          {t(m.mail_code_title)}
        </Text>
        <Text style={{ ...text.body, marginTop: 8, color: tone.ink2 }}>
          {t(m.mail_code_intro)}
        </Text>
        <Row style={{ margin: '28px 0 26px', width: 'auto' }}>
          {[...code].map((digit, index) => (
            <Column
              key={index}
              style={{ paddingRight: index === code.length - 1 ? 0 : 8 }}
            >
              <Text
                style={{
                  margin: 0,
                  width: 44,
                  height: 56,
                  borderRadius: 12,
                  border: `1px solid ${tone.edge}`,
                  backgroundColor: tone.stub,
                  fontSize: 26,
                  lineHeight: '56px',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  textAlign: 'center',
                  color: tone.ink,
                }}
              >
                {digit}
              </Text>
            </Column>
          ))}
        </Row>
        <Text style={text.small}>
          {t(m.mail_code_expiry)} {t(m.mail_code_ignore)}
        </Text>
      </Section>
    </Frame>
  );
}

SignInCode.PreviewProps = {
  locale: 'es',
  code: '418207',
  accountUrl: 'https://hadronomy.com/invoices/account',
} satisfies SignInCodeProps;

export default SignInCode;
