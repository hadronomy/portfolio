import type { Language } from './model';

// Reusable conditions for quotes. A clause is published by id and version,
// and a published version never changes its words: an accepted quote's
// customer agreed to exactly that text. To change a clause, add a version
// with the new words and leave the old one in place. Bodies are Markdown in
// the page schema's dialect, without headings, which the PDF sets itself.
//
// These texts are a careful starting point for a sole trader, not legal
// advice. Have a lawyer review them before relying on them.

/** Who a clause may be offered to. Some terms are void against consumers. */
export type ClauseAudience = 'everyone' | 'business';

export interface ClauseText {
  readonly title: string;
  readonly body: string;
}

export interface ClauseVersion {
  readonly version: number;
  readonly audience: ClauseAudience;
  /** The law the clause follows, as printed under it. */
  readonly source: string;
  readonly text: Record<Language, ClauseText>;
}

export interface Clause {
  readonly id: string;
  /** Published versions, oldest first. New insertions use the last one. */
  readonly versions: readonly ClauseVersion[];
}

export const clauses: readonly Clause[] = [
  {
    id: 'scope',
    versions: [
      {
        version: 1,
        audience: 'everyone',
        source: 'Código Civil, arts. 1254 y 1258',
        text: {
          es: {
            title: 'Alcance y cambios',
            body: 'El presupuesto cubre el trabajo y las entregas que describe. Cualquier trabajo fuera de ese alcance necesita un presupuesto nuevo o revisado, que el cliente acepta antes de que empiece.',
          },
          en: {
            title: 'Scope and changes',
            body: 'This quote covers the work and deliverables it describes. Any work outside that scope needs a new or revised quote, which the customer accepts before the work starts.',
          },
        },
      },
    ],
  },
  {
    id: 'revisions',
    versions: [
      {
        version: 1,
        audience: 'everyone',
        source: 'Código Civil, art. 1258',
        text: {
          es: {
            title: 'Revisiones',
            body: 'Cada entrega incluye dos rondas de revisión. Una revisión ajusta el trabajo entregado; no cambia su alcance. Las rondas adicionales se presupuestan aparte.',
          },
          en: {
            title: 'Revisions',
            body: 'Each deliverable includes two rounds of revisions. A revision adjusts the delivered work; it does not change its scope. Further rounds are quoted separately.',
          },
        },
      },
    ],
  },
  {
    id: 'payment-terms',
    versions: [
      {
        version: 1,
        audience: 'everyone',
        source: 'Ley 7/2012, art. 7',
        text: {
          es: {
            title: 'Forma de pago',
            body: 'Cada pago se factura en su fecha, según el calendario de este presupuesto, y se paga por transferencia a la cuenta que indica la factura, o con tarjeta cuando la factura ofrece un enlace de pago. La ley no permite pagos en efectivo de 1.000 € o más cuando una de las partes actúa como empresario o profesional.',
          },
          en: {
            title: 'Payment',
            body: "Each payment is invoiced on its date, as this quote's schedule sets out, and is paid by bank transfer to the account the invoice states, or by card when the invoice offers a payment link. The law forbids cash payments of €1,000 or more when either party acts as a business or professional.",
          },
        },
      },
    ],
  },
  {
    id: 'late-payment',
    versions: [
      {
        version: 1,
        audience: 'business',
        source: 'Ley 3/2004, arts. 4, 7 y 8',
        text: {
          es: {
            title: 'Retrasos en el pago',
            body: 'Cada factura se paga en el plazo que indica, que no supera los 60 días. Un pago atrasado devenga, sin necesidad de aviso, el interés legal de demora: el tipo del Banco Central Europeo más ocho puntos. Además, cada factura atrasada da derecho a 40 € por costes de cobro.',
          },
          en: {
            title: 'Late payment',
            body: 'Each invoice is paid within the period it states, which is no longer than 60 days. A late payment accrues statutory late-payment interest without notice: the European Central Bank rate plus eight points. Each late invoice also carries €40 in recovery costs.',
          },
        },
      },
    ],
  },
  {
    id: 'copyright',
    versions: [
      {
        version: 1,
        audience: 'everyone',
        source:
          'Real Decreto Legislativo 1/1996 (Ley de Propiedad Intelectual), arts. 14, 43 y 48',
        text: {
          es: {
            title: 'Propiedad intelectual',
            body: 'Cuando el presupuesto está pagado por completo, el autor cede al cliente, en exclusiva, los derechos de reproducción, distribución, comunicación pública y transformación de las entregas finales, para todo el mundo y por el plazo de protección que fija la ley. Los archivos de trabajo y las propuestas descartadas no se ceden. El autor conserva sus derechos morales, que la ley declara irrenunciables, y puede mostrar el trabajo en su portfolio.',
          },
          en: {
            title: 'Copyright',
            body: 'Once the quote is paid in full, the author assigns to the customer, exclusively, the rights to reproduce, distribute, communicate to the public, and transform the final deliverables, worldwide, for the term of protection the law sets. Working files and discarded proposals are not assigned. The author keeps their moral rights, which the law makes inalienable, and may show the work in their portfolio.',
          },
        },
      },
    ],
  },
  {
    id: 'confidentiality',
    versions: [
      {
        version: 1,
        audience: 'everyone',
        source: 'Código Civil, art. 1258',
        text: {
          es: {
            title: 'Confidencialidad',
            body: 'Las dos partes guardan reserva sobre la información de la otra que conocen por este trabajo y no la usan para otro fin. El deber continúa cuando termina el trabajo, salvo para la información que ya es pública.',
          },
          en: {
            title: 'Confidentiality',
            body: "Each party keeps confidential the other's information that it learns through this work, and uses it for no other purpose. The duty continues after the work ends, except for information that is already public.",
          },
        },
      },
    ],
  },
  {
    id: 'cancellation',
    versions: [
      {
        version: 1,
        audience: 'everyone',
        source: 'Código Civil, art. 1594',
        text: {
          es: {
            title: 'Cancelación',
            body: 'El cliente puede cancelar el trabajo en cualquier momento por escrito. Paga el trabajo hecho hasta esa fecha, en proporción al precio total, y recibe lo que se haya entregado. Esta cláusula no limita el derecho de desistimiento de un consumidor.',
          },
          en: {
            title: 'Cancellation',
            body: "The customer can cancel the work at any time in writing. They pay for the work done up to that date, in proportion to the total price, and receive what has been delivered. This clause does not limit a consumer's right of withdrawal.",
          },
        },
      },
    ],
  },
  {
    id: 'liability',
    versions: [
      {
        version: 1,
        audience: 'business',
        source: 'Código Civil, arts. 1102 y 1255',
        text: {
          es: {
            title: 'Responsabilidad',
            body: 'La responsabilidad del autor por este trabajo no supera el precio de este presupuesto, salvo en caso de dolo o culpa grave. Ninguna parte responde de daños indirectos ni del lucro cesante.',
          },
          en: {
            title: 'Liability',
            body: "The author's liability for this work does not exceed the price of this quote, except for wilful misconduct or gross negligence. Neither party is liable for indirect damage or lost profit.",
          },
        },
      },
    ],
  },
];

/** A clause version, or undefined when no such version was published. */
export function clauseVersion(
  id: string,
  version: number,
): ClauseVersion | undefined {
  return clauses
    .find((clause) => clause.id === id)
    ?.versions.find((item) => item.version === version);
}

/** The version new insertions of a clause use. */
export function latestVersion(clause: Clause): ClauseVersion {
  const last = clause.versions.at(-1);
  if (!last) throw new Error(`Clause ${clause.id} has no published version.`);
  return last;
}
