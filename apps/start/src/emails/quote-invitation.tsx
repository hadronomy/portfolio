import { type Locale, translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { Section, Text } from 'react-email';
import { Action } from '~/emails/_parts/action';
import { Foot, Frame, text, tone } from '~/emails/_parts/frame';
import { Face, Ticket } from '~/emails/_parts/ticket';

// A quote, sent to its customer. It is the ticket they will sign, face up:
// what the quote is and until when it stands. The price waits for the
// quote itself, read whole with its terms, rather than landing first in an
// inbox. Below the perforation, the owner's own words when they wrote
// some, and the one thing to do. The PDF rides along for their records.

export interface QuoteInvitationProps {
  readonly locale: Locale;
  readonly issuer: string;
  readonly number: string;
  readonly title: string;
  readonly validUntil: string;
  /** A few words from the owner, as they typed them. */
  readonly note: string;
  /** The customer's link to the quote page. */
  readonly url: string;
}

export function QuoteInvitation(props: QuoteInvitationProps) {
  const t = translate(props.locale);
  const note = props.note.trim();
  return (
    <Frame
      locale={props.locale}
      preview={t(m.invite_preview, { date: props.validUntil })}
      foot={<Foot>{t(m.invite_why, { issuer: props.issuer })}</Foot>}
    >
      <Ticket
        face={
          <Face
            kicker={`${props.issuer} · ${t(m.quote_quote)} ${props.number}`}
            title={props.title}
            total={null}
            status={t(m.quote_valid_until, { date: props.validUntil })}
            done={false}
          />
        }
        slip={
          <>
            {note && (
              <Section style={{ marginBottom: 22 }}>
                <Text style={{ ...text.body, whiteSpace: 'pre-line' }}>
                  {note}
                </Text>
                <Text style={{ ...text.small, marginTop: 8 }}>
                  {props.issuer}
                </Text>
              </Section>
            )}
            <Text style={text.body}>{t(m.invite_lead)}</Text>
            <Section style={{ marginTop: 22 }}>
              <Action href={props.url}>{t(m.quote_review)}</Action>
            </Section>
            <Text style={{ ...text.small, marginTop: 22 }}>
              {t(m.invite_attached)}
            </Text>
            <Text style={{ ...text.fine, marginTop: 6, color: tone.ink3 }}>
              {t(m.invite_link, { date: props.validUntil })}
            </Text>
          </>
        }
      />
    </Frame>
  );
}

QuoteInvitation.PreviewProps = {
  locale: 'es',
  issuer: 'Estudio Ejemplo',
  number: 'P-2026-0002',
  title: 'Rediseño de la tienda online',
  validUntil: '2026-11-10',
  note: 'Hola, Lucía:\nTe paso el presupuesto que hablamos el martes. Si te cuadra, puedes firmarlo directamente desde el enlace.',
  url: 'https://hadronomy.com/invoices/quote/preview',
} satisfies QuoteInvitationProps;

export default QuoteInvitation;
