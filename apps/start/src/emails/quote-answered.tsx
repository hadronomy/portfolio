import { type Locale, translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { Section, Text } from 'react-email';
import { Action } from './_parts/action';
import { Foot, Frame, text, tone } from './_parts/frame';
import { Face, Signed, Ticket } from './_parts/ticket';
import type { QuoteAnswerProps } from './quote-answer';

// The owner's word that a customer answered: the same ticket the customer
// signed, what to do next, and the evidence the acceptance rests on. On an
// acceptance the signed copy rides along.

export interface QuoteAnsweredProps
  extends Omit<QuoteAnswerProps, 'url' | 'locale'> {
  readonly locale: Locale;
  readonly email: string;
  /** The quote in the workspace. */
  readonly url: string;
  readonly address: string;
  readonly agent: string;
}

export function QuoteAnswered(props: QuoteAnsweredProps) {
  const t = translate(props.locale);
  const accepted = props.outcome === 'accepted';
  const day = props.decidedAt.slice(0, 10);
  return (
    <Frame
      locale={props.locale}
      preview={t(m.owner_mail_preview, { outcome: props.outcome })}
      foot={<Foot>{t(m.owner_mail_why, { email: props.email })}</Foot>}
    >
      <Ticket
        face={
          <Face
            kicker={`${t(m.quote_quote)} ${props.number}`}
            title={props.title}
            totalLabel={t(m.quote_total)}
            total={props.total}
            status={t(accepted ? m.quote_accepted : m.quote_declined, {
              name: props.name,
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
            {props.plan && (
              <Section>
                <Text style={{ ...text.small, color: tone.ink3 }}>
                  {t(m.doc_plan)}
                </Text>
                <Text style={{ ...text.body, marginTop: 2 }}>{props.plan}</Text>
              </Section>
            )}
            {props.earlyStart && (
              <Text style={{ ...text.small, marginTop: 16 }}>
                {t(m.accept_early_yes)}
              </Text>
            )}
            <Text style={{ ...text.small, marginTop: 16 }}>
              {t(m.owner_mail_next, { outcome: props.outcome })}
            </Text>
            <Section style={{ marginTop: 24 }}>
              <Action href={props.url}>{t(m.owner_mail_open)}</Action>
            </Section>
            <Text style={{ ...text.fine, marginTop: 24 }}>
              {t(m.accept_at, { decidedAt: props.decidedAt })} ·{' '}
              {t(m.accept_evidence_detail, {
                address: props.address || '—',
                agent: props.agent || '—',
              })}
            </Text>
            <Text style={{ ...text.fine, marginTop: 6 }}>
              {t(m.owner_mail_document, { digest: props.digest })}
            </Text>
          </>
        }
      />
    </Frame>
  );
}

QuoteAnswered.PreviewProps = {
  locale: 'en',
  outcome: 'accepted',
  issuer: 'Estudio Ejemplo',
  number: 'P-2026-0002',
  title: 'Rediseño de la tienda online',
  total: '€2,380.75',
  decidedAt: '2026-10-11T14:03:22.000Z',
  name: 'Lucía Martín Pérez',
  email: 'lucia@example.test',
  plan: '30% on acceptance and the rest on delivery.',
  earlyStart: true,
  digest: 'a3f1c9e07b2d4e6f8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9d1e3f',
  url: 'https://hadronomy.com/invoices/preview',
  address: '203.0.113.7',
  agent: 'Mozilla/5.0 (Macintosh) Chrome/141.0',
  signature: null,
} satisfies QuoteAnsweredProps;

export default QuoteAnswered;
