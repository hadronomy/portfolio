import { formatDay } from './labels';
import type { InvoiceData, Language, QuoteTerms } from './model';

// The notices a quote prints whatever its pages say. They follow from who
// the customer is and from the quote being accepted online, so the owner
// cannot leave one out by accident. docs/research/quotes-editor-mcp.md maps
// each one to its source.

export interface Notice {
  readonly id:
    | 'validity'
    | 'taxes'
    | 'acceptance'
    | 'withdrawal'
    | 'complaints'
    | 'privacy';
  readonly title: string;
  readonly body: string;
  readonly source: string;
}

const languageName: Record<Language, Record<Language, string>> = {
  en: { en: 'English', es: 'Spanish' },
  es: { en: 'inglés', es: 'español' },
};

/** The required notices for a quote, in the order they print. */
export function quoteNotices(
  data: InvoiceData,
  quote: QuoteTerms,
  language: Language,
): readonly Notice[] {
  const consumer = data.customerType === 'consumer';
  // Decreto 90/2023 binds traders serving consumers in the Canary Islands.
  const canary =
    data.issuer.canaryEstablished ||
    data.customerTerritory === 'canary-islands';
  const issuer = data.issuer.name || '—';
  const email = data.issuer.email || '—';
  const until = formatDay(quote.validUntil, language);
  const spoken = languageName[language][data.language];
  const es = language === 'es';
  const notices: Notice[] = [
    {
      id: 'validity',
      title: es ? 'Validez' : 'Validity',
      body: es
        ? `Este presupuesto es válido hasta el ${until}. Una vez aceptado, obliga a las dos partes en sus términos. No es una factura: cada pago se factura cuando corresponde.`
        : `This quote is valid until ${until}. Once accepted, it binds both parties on its terms. It is not an invoice: each payment is invoiced when it falls due.`,
      source: consumer
        ? 'Ley 3/2003 de Canarias, art. 11.1.c; Código Civil, art. 1262'
        : 'Código Civil, arts. 1254 y 1262',
    },
  ];
  if (consumer)
    notices.push({
      id: 'taxes',
      title: es ? 'Precio' : 'Price',
      body: es
        ? 'El precio total incluye el IGIC y todos los demás impuestos aplicables.'
        : 'The total price includes IGIC and every other applicable tax.',
      source: 'Real Decreto Legislativo 1/2007, arts. 20.1.c y 60.2.c',
    });
  notices.push({
    id: 'acceptance',
    title: es ? 'Cómo se acepta' : 'How to accept',
    body: es
      ? `El cliente abre el enlace del presupuesto, lo lee, escribe su nombre completo y lo acepta. Esa aceptación es su firma electrónica. ${issuer} guarda el documento aceptado y envía una copia por correo electrónico en las 24 horas siguientes. Antes de aceptar, el cliente puede pedir un presupuesto revisado para corregir cualquier dato. El contrato se formaliza en ${spoken}.`
      : `The customer opens the quote's link, reads it, types their full name, and accepts it. That acceptance is their electronic signature. ${issuer} keeps the accepted document and emails a copy within 24 hours. Before accepting, the customer can ask for a revised quote to correct anything. The contract is concluded in ${spoken}.`,
    source: 'Ley 34/2002, arts. 27 y 28; Reglamento (UE) 910/2014, art. 25.1',
  });
  if (consumer)
    notices.push({
      id: 'withdrawal',
      title: es ? 'Derecho de desistimiento' : 'Right of withdrawal',
      body: es
        ? `El cliente puede desistir del contrato en un plazo de 14 días naturales desde el día en que acepta el presupuesto, sin dar ningún motivo y sin coste. Para hacerlo, basta con decirlo de forma clara a ${email}, por ejemplo con el formulario del final de este documento. El trabajo no empieza en ese plazo salvo que el cliente lo pida expresamente al aceptar. En ese caso, si después desiste, paga la parte ya hecha en proporción al precio total, y pierde el derecho cuando el trabajo esté completamente hecho.`
        : `The customer can withdraw from the contract within 14 calendar days of the day they accept the quote, without giving any reason and at no cost. To do so, they only need to say so clearly to ${email}, for example with the form at the end of this document. Work does not start within that period unless the customer expressly asks for it when accepting. In that case, if they then withdraw, they pay for the part already done in proportion to the total price, and they lose the right once the work is fully done.`,
      source:
        'Real Decreto Legislativo 1/2007, arts. 97.1.i, 98.8, 102, 103.a, 104.a, 106 y 108.4',
    });
  if (consumer && canary)
    notices.push({
      id: 'complaints',
      title: es ? 'Atención a la clientela' : 'Customer service',
      body: es
        ? `Las quejas y reclamaciones se atienden en ${email}, con respuesta en el plazo de un mes. El cliente tiene a su disposición hojas de reclamaciones oficiales.`
        : `Complaints are handled at ${email}, with an answer within one month. Official complaint forms are available to the customer.`,
      source: 'Decreto 90/2023 de Canarias, arts. 5 y 6',
    });
  notices.push({
    id: 'privacy',
    title: es ? 'Protección de datos' : 'Data protection',
    body: es
      ? `${issuer}${data.issuer.taxId ? ` (${data.issuer.taxId})` : ''} trata los datos del cliente para preparar este presupuesto y, si se acepta, para cumplir el contrato. Los conserva mientras dura la relación y durante los plazos que fija la ley. El cliente puede pedir el acceso, la rectificación, la supresión, la limitación, la portabilidad de sus datos u oponerse a su tratamiento en ${email}, y reclamar ante la Agencia Española de Protección de Datos (aepd.es).`
      : `${issuer}${data.issuer.taxId ? ` (${data.issuer.taxId})` : ''} processes the customer's data to prepare this quote and, if it is accepted, to perform the contract. It keeps the data for the length of the relationship and the periods the law sets. The customer can ask for access, rectification, erasure, restriction, or portability of their data, or object to its processing, at ${email}, and can complain to the Spanish Data Protection Agency (aepd.es).`,
    source:
      'Reglamento (UE) 2016/679, arts. 6.1.b y 13; Ley Orgánica 3/2018, art. 11',
  });
  return notices;
}

/** Whether the quote prints the model withdrawal form: only a consumer can withdraw. */
export const printsWithdrawalForm = (data: InvoiceData) =>
  data.kind === 'quote' && data.customerType === 'consumer';
