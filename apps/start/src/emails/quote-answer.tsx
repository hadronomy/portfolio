import { type Locale, translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { Section, Text } from 'react-email';
import { Action } from './_parts/action';
import { Foot, Frame, text, tone } from './_parts/frame';
import { Face, Signed, Ticket } from './_parts/ticket';

// The confirmation the law asks for within 24 hours of an online
// acceptance (Ley 34/2002, art. 28), sent to the customer. It is the
// ticket they answered on, now showing the answer: the signature on its
// line, what they agreed to, and the signed copy attached.

export interface QuoteAnswerProps {
  readonly locale: Locale;
  readonly outcome: 'accepted' | 'declined';
  readonly issuer: string;
  readonly number: string;
  readonly title: string;
  /** The total, formatted in the quote's language and currency. */
  readonly total: string;
  readonly decidedAt: string;
  readonly name: string;
  /** The accepted plan as one sentence, when there is one. */
  readonly plan: string | null;
  readonly earlyStart: boolean;
  readonly digest: string;
  /** The quote's page, where it can be read and downloaded again. */
  readonly url: string;
  /** The signature as an inline image, on an acceptance. */
  readonly signature: {
    readonly src: string;
    readonly width: number;
    readonly height: number;
  } | null;
}

export function QuoteAnswer(props: QuoteAnswerProps) {
  const t = translate(props.locale);
  const accepted = props.outcome === 'accepted';
  const day = props.decidedAt.slice(0, 10);
  return (
    <Frame
      locale={props.locale}
      preview={t(m.mail_answer_preview, {
        outcome: props.outcome,
        issuer: props.issuer,
      })}
      foot={<Foot>{t(m.mail_answer_why, { issuer: props.issuer })}</Foot>}
    >
      <Ticket
        face={
          <Face
            kicker={`${props.issuer} · ${t(m.quote_quote)} ${props.number}`}
            title={props.title}
            totalLabel={t(m.quote_total)}
            total={props.total}
            status={t(accepted ? m.quote_accepted_on : m.quote_declined_on, {
              date: day,
            })}
            done={accepted}
          />
        }
        slip={
          <>
            {props.signature && (
              <Signed
                {...props.signature}
                alt={t(m.quote_signed_by, { name: props.name })}
                name={props.name}
                day={t(m.date_long, { date: day })}
              />
            )}
            <Text style={text.body}>
              {t(m.mail_answer_decided, {
                outcome: props.outcome,
                name: props.name,
                number: props.number,
                issuer: props.issuer,
                decidedAt: props.decidedAt,
              })}
            </Text>
            {props.plan && (
              <Section style={{ marginTop: 16 }}>
                <Text style={{ ...text.small, color: tone.ink3 }}>
                  {t(m.doc_plan)}
                </Text>
                <Text style={{ ...text.body, marginTop: 2 }}>{props.plan}</Text>
              </Section>
            )}
            {props.earlyStart && (
              <Text style={{ ...text.small, marginTop: 16 }}>
                {t(m.mail_answer_early_start)}
              </Text>
            )}
            {accepted && (
              <Text style={{ ...text.small, marginTop: 16 }}>
                {t(m.mail_answer_attached)}
              </Text>
            )}
            <Section style={{ marginTop: 24 }}>
              <Action href={props.url}>{t(m.mail_answer_open)}</Action>
            </Section>
            <Text style={{ ...text.fine, marginTop: 24 }}>
              {t(m.mail_answer_document, { digest: props.digest })}{' '}
              {t(m.mail_answer_keep, { outcome: props.outcome })}
            </Text>
          </>
        }
      />
    </Frame>
  );
}

QuoteAnswer.PreviewProps = {
  locale: 'es',
  outcome: 'accepted',
  issuer: 'Estudio Ejemplo',
  number: 'P-2026-0002',
  title: 'Rediseño de la tienda online',
  total: '2380,75 €',
  decidedAt: '2026-10-11T14:03:22.000Z',
  name: 'Lucía Martín Pérez',
  plan: '30 % al aceptar y el resto a la entrega.',
  earlyStart: true,
  digest: 'a3f1c9e07b2d4e6f8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9d1e3f',
  url: 'https://hadronomy.com/invoices/quote/preview',
  signature: null,
} satisfies QuoteAnswerProps;

export default QuoteAnswer;
