import type { Language } from '@portfolio/invoices/model';

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
      'Your typed name is your electronic signature. We keep the time, this browser and the fingerprint of the document you accept.',
    fingerprint: 'Fingerprint',
    stampAccepted: 'Accepted',
    accepted: (name: string, day: string) => `Accepted by ${name} on ${day}`,
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
      'Tu nombre escrito es tu firma electrónica. Guardamos la hora, este navegador y la huella del documento que aceptas.',
    fingerprint: 'Huella',
    stampAccepted: 'Aceptado',
    accepted: (name: string, day: string) => `Aceptado por ${name} el ${day}`,
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
