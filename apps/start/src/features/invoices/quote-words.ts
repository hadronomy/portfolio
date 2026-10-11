import type { Language } from '@portfolio/invoices/model';
import type { PadWords } from '../../components/arc/signature-pad/signature-pad';

// The customer's quote page, in the quote's language.

export const quoteWords = {
  en: {
    quote: 'Quote',
    total: 'Total, taxes included',
    validUntil: (day: string) => `Valid until ${day}`,
    daysLeft: (days: number) =>
      days === 0 ? 'Last day' : days === 1 ? '1 day left' : `${days} days left`,
    pdf: 'PDF',
    pdfLabel: 'Download the quote as a PDF',
    pages: 'The proposal',
    legal: 'Legal information',
    howYouPay: 'How you pay',
    option: (index: number) => `Option ${index}`,
    onAcceptance: 'on acceptance',
    paying: 'You pay',
    name: 'Your full name',
    namePlaceholder: 'As on your ID',
    agree:
      'I have read this quote, its conditions and the legal information, and I accept them.',
    earlyStart: 'Start the work before the 14-day withdrawal period ends',
    earlyStartDetail:
      'If you then withdraw, you pay for the part already done. You lose the right to withdraw once the work is fully done.',
    accept: 'Accept and sign',
    accepting: 'Signing',
    decline: 'Decline this quote',
    declineConfirm: (issuer: string) =>
      `${issuer} will see that you do not accept it.`,
    declineYes: 'Decline',
    declineNo: 'Keep it',
    signature:
      'Your name and the signature you draw are your electronic signature. We keep the time, this browser and the fingerprint of the document you accept.',
    sign: 'Your signature',
    signHint: 'Sign here',
    signedBy: (name: string) => `Signature of ${name}`,
    pad: {
      undo: 'Undo',
      redo: 'Redo',
      clear: 'Clear the signature',
      state: (strokes: number) =>
        `${strokes === 0 ? 'Empty.' : strokes === 1 ? '1 stroke.' : `${strokes} strokes.`} Draw with a mouse, a pen or a finger.`,
      keys: 'Control or Command Z undoes, with Shift it redoes, and Delete clears.',
      added: (strokes: number) =>
        strokes === 1 ? 'Stroke added.' : `Stroke added. ${strokes} in all.`,
      undone: 'Undone',
      redone: 'Redone',
      cleared: 'Signature cleared. Undo brings it back.',
    } satisfies PadWords,
    pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
    pageCount: (pages: number) => (pages === 1 ? '1 page' : `${pages} pages`),
    asText: 'Read it as text',
    review: 'Review and sign',
    answer: 'See the answer',
    back: 'Back to the quote',
    fingerprint: 'Fingerprint',
    stampAccepted: 'Accepted',
    accepted: (name: string, day: string) => `Accepted by ${name} on ${day}`,
    acceptedOn: (day: string) => `Accepted on ${day}`,
    declinedOn: (day: string) => `Declined on ${day}`,
    declined: (name: string, day: string) => `Declined by ${name} on ${day}`,
    emailed: (email: string) => `A copy went to ${email}.`,
    earlyStarted:
      'You asked for the work to start within the withdrawal period.',
    expired: (day: string) => `This quote expired on ${day}`,
    expiredDetail: (issuer: string) => `Write to ${issuer} for a new one.`,
    stale:
      'This quote changed while the page was open. Reload it to read the current version.',
    reload: 'Reload',
    failed: 'Your answer could not be saved. Try again in a moment.',
    write: (email: string) => `Write to ${email}`,
    invalid: 'This link does not open a quote',
    invalidDetail: 'It may have expired or been closed. Ask for a new link.',
    lines: 'Items',
    from: 'From',
    to: 'For',
  },
  es: {
    quote: 'Presupuesto',
    total: 'Total, impuestos incluidos',
    validUntil: (day: string) => `Válido hasta el ${day}`,
    daysLeft: (days: number) =>
      days === 0
        ? 'Último día'
        : days === 1
          ? 'Queda 1 día'
          : `Quedan ${days} días`,
    pdf: 'PDF',
    pdfLabel: 'Descargar el presupuesto en PDF',
    pages: 'La propuesta',
    legal: 'Información legal',
    howYouPay: 'Cómo pagas',
    option: (index: number) => `Opción ${index}`,
    onAcceptance: 'al aceptar',
    paying: 'Pagas',
    name: 'Tu nombre completo',
    namePlaceholder: 'Como en tu documento de identidad',
    agree:
      'He leído este presupuesto, sus condiciones y la información legal, y los acepto.',
    earlyStart:
      'Empezar el trabajo antes de que acabe el plazo de desistimiento de 14 días',
    earlyStartDetail:
      'Si después desistes, pagas la parte ya hecha. Pierdes el derecho a desistir cuando el trabajo esté completamente hecho.',
    accept: 'Aceptar y firmar',
    accepting: 'Firmando',
    decline: 'Rechazar este presupuesto',
    declineConfirm: (issuer: string) => `${issuer} verá que no lo aceptas.`,
    declineYes: 'Rechazar',
    declineNo: 'Mantenerlo',
    signature:
      'Tu nombre y la firma que dibujas son tu firma electrónica. Guardamos la hora, este navegador y la huella del documento que aceptas.',
    sign: 'Tu firma',
    signHint: 'Firma aquí',
    signedBy: (name: string) => `Firma de ${name}`,
    pad: {
      undo: 'Deshacer',
      redo: 'Rehacer',
      clear: 'Borrar la firma',
      state: (strokes: number) =>
        `${strokes === 0 ? 'Vacío.' : strokes === 1 ? '1 trazo.' : `${strokes} trazos.`} Dibuja con el ratón, un lápiz o el dedo.`,
      keys: 'Control o Comando Z deshace, con Mayúsculas rehace, y Suprimir borra.',
      added: (strokes: number) =>
        strokes === 1
          ? 'Trazo añadido.'
          : `Trazo añadido. ${strokes} en total.`,
      undone: 'Deshecho',
      redone: 'Rehecho',
      cleared: 'Firma borrada. Deshacer la recupera.',
    } satisfies PadWords,
    pageOf: (page: number, pages: number) => `Página ${page} de ${pages}`,
    pageCount: (pages: number) =>
      pages === 1 ? '1 página' : `${pages} páginas`,
    asText: 'Leerlo como texto',
    review: 'Revisar y firmar',
    answer: 'Ver la respuesta',
    back: 'Volver al presupuesto',
    fingerprint: 'Huella',
    stampAccepted: 'Aceptado',
    accepted: (name: string, day: string) => `Aceptado por ${name} el ${day}`,
    acceptedOn: (day: string) => `Aceptado el ${day}`,
    declinedOn: (day: string) => `Rechazado el ${day}`,
    declined: (name: string, day: string) => `Rechazado por ${name} el ${day}`,
    emailed: (email: string) => `Hemos enviado una copia a ${email}.`,
    earlyStarted:
      'Pediste que el trabajo empezara dentro del plazo de desistimiento.',
    expired: (day: string) => `Este presupuesto caducó el ${day}`,
    expiredDetail: (issuer: string) =>
      `Escribe a ${issuer} para pedir uno nuevo.`,
    stale:
      'Este presupuesto ha cambiado mientras la página estaba abierta. Recárgala para leer la versión actual.',
    reload: 'Recargar',
    failed:
      'No se ha podido guardar tu respuesta. Inténtalo de nuevo en un momento.',
    write: (email: string) => `Escribir a ${email}`,
    invalid: 'Este enlace no abre un presupuesto',
    invalidDetail:
      'Puede haber caducado o estar cerrado. Pide un enlace nuevo.',
    lines: 'Conceptos',
    from: 'De',
    to: 'Para',
  },
} satisfies Record<Language, unknown>;

export type QuoteWords = (typeof quoteWords)[Language];
