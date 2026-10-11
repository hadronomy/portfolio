import { formatMoney } from '@portfolio/invoices/calculate';
import type { CheckoutInvoice } from '@portfolio/invoices/collection-model';
import type { Language } from '@portfolio/invoices/model';

// What the payment page says, in the invoice's own language. The customer
// reads the invoice in the language it was written for them, so the page
// around it does too.

export const words = {
  en: {
    invoice: 'Invoice',
    from: 'From',
    billedTo: 'Billed to',
    issued: (date: string) => `Issued ${date}`,
    more: (count: number) =>
      count === 1 ? 'Show 1 more line' : `Show ${count} more lines`,
    fewer: 'Show fewer lines',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'IGIC',
    withholding: 'Withholding',
    disbursements: 'Disbursements',
    total: 'Total',
    received: (date: string) => `Received ${date}`,
    pdf: 'PDF',
    pdfLabel: 'Download the invoice as a PDF',
    due: 'Amount due',
    amountPaid: 'Amount paid',
    dueOn: (date: string) => `Due ${date}`,
    overdue: (date: string) => `Was due ${date}`,
    nextPayment: 'Next payment',
    dueNow: 'Due now',
    paymentOf: (index: number, of: number) => `Payment ${index} of ${of}`,
    plan: 'Payment plan',
    howToPay: 'How would you like to pay?',
    payNow: 'to pay now',
    howMuchNow: 'How much now?',
    yourPlan: (name: string) => `Your plan: ${name}`,
    left: (amount: string) => `${amount} left`,
    paidPart: (amount: string) => `${amount} paid`,
    state: { paid: 'Paid', due: 'Due today', late: 'Late', upcoming: '' },
    choices: {
      next: 'Next payment',
      due: 'Everything due now',
      all: 'Everything left',
    },
    whole: 'Full amount',
    other: 'Another amount',
    howMuch: 'Amount to pay',
    range: (from: string, to: string) => `From ${from} to ${to}.`,
    tooSmall: (from: string) => `Pay at least ${from}.`,
    tooLarge: (to: string) => `Pay up to ${to}, or choose everything left.`,
    unreadable: 'Enter an amount like 250.00.',
    pay: (amount: string) => `Pay ${amount}`,
    confirming: 'Confirming…',
    failed: 'The payment did not go through. Check the details and try again.',
    unreachable:
      'Payment could not start. Nothing was charged; try again in a moment.',
    unloaded: 'The payment form did not load. Reload the page to try again.',
    thanks: (amount: string) => `${amount} received. Thank you.`,
    settling: 'Payment taken. It shows here in a moment.',
    processing: (amount: string) => `${amount} is on its way`,
    processingDetail:
      'Your bank is confirming it. This page updates by itself once it clears.',
    check: 'Check now',
    paid: 'Paid in full',
    paidOn: (date: string) => `Settled ${date}. Thank you.`,
    stamp: 'Paid',
    paused: 'Online payment is paused',
    pausedDetail: (issuer: string) =>
      `${issuer || 'The sender'} is reconciling this invoice. Get in touch to settle it.`,
    write: (email: string) => `Write to ${email}`,
    secured: 'Payments are processed by Stripe',
    invalid: 'This payment link does not open',
    invalidDetail:
      'It may have expired or been closed. Ask the sender for a new one.',
    keep: 'Keep your invoices',
    keepDetail: (issuer: string) =>
      `See every invoice from ${issuer || 'this sender'} in one place, any time.`,
    kept: 'This invoice is in your account.',
    allInvoices: 'All your invoices',
  },
  es: {
    invoice: 'Factura',
    from: 'Emisor',
    billedTo: 'Cliente',
    issued: (date: string) => `Emitida el ${date}`,
    more: (count: number) =>
      count === 1 ? 'Ver 1 línea más' : `Ver ${count} líneas más`,
    fewer: 'Ver menos líneas',
    subtotal: 'Subtotal',
    discount: 'Descuento',
    tax: 'IGIC',
    withholding: 'Retención',
    disbursements: 'Suplidos',
    total: 'Total',
    received: (date: string) => `Recibido el ${date}`,
    pdf: 'PDF',
    pdfLabel: 'Descargar la factura en PDF',
    due: 'Importe pendiente',
    amountPaid: 'Importe pagado',
    dueOn: (date: string) => `Vence el ${date}`,
    overdue: (date: string) => `Venció el ${date}`,
    nextPayment: 'Próximo pago',
    dueNow: 'Pendiente ahora',
    paymentOf: (index: number, of: number) => `Pago ${index} de ${of}`,
    plan: 'Plan de pagos',
    howToPay: '¿Cómo quieres pagar?',
    payNow: 'a pagar ahora',
    howMuchNow: '¿Cuánto pagas ahora?',
    yourPlan: (name: string) => `Tu plan: ${name}`,
    left: (amount: string) => `Quedan ${amount}`,
    paidPart: (amount: string) => `${amount} pagados`,
    state: { paid: 'Pagado', due: 'Vence hoy', late: 'Atrasado', upcoming: '' },
    choices: {
      next: 'Próximo pago',
      due: 'Todo lo vencido',
      all: 'Todo lo pendiente',
    },
    whole: 'Importe total',
    other: 'Otro importe',
    howMuch: 'Importe a pagar',
    range: (from: string, to: string) => `De ${from} a ${to}.`,
    tooSmall: (from: string) => `Paga al menos ${from}.`,
    tooLarge: (to: string) => `Paga hasta ${to}, o elige todo lo pendiente.`,
    unreadable: 'Escribe un importe como 250,00.',
    pay: (amount: string) => `Pagar ${amount}`,
    confirming: 'Confirmando…',
    failed:
      'El pago no se ha completado. Revisa los datos e inténtalo de nuevo.',
    unreachable:
      'No se ha podido iniciar el pago. No se ha cobrado nada; inténtalo en un momento.',
    unloaded:
      'El formulario de pago no se ha cargado. Recarga la página para intentarlo de nuevo.',
    thanks: (amount: string) => `${amount} recibidos. Gracias.`,
    settling: 'Pago realizado. Aparecerá aquí en un momento.',
    processing: (amount: string) => `${amount} en camino`,
    processingDetail:
      'Tu banco lo está confirmando. Esta página se actualiza sola cuando se complete.',
    check: 'Comprobar ahora',
    paid: 'Pagada por completo',
    paidOn: (date: string) => `Liquidada el ${date}. Gracias.`,
    stamp: 'Pagada',
    paused: 'El pago en línea está en pausa',
    pausedDetail: (issuer: string) =>
      `${issuer || 'El emisor'} está revisando esta factura. Ponte en contacto para liquidarla.`,
    write: (email: string) => `Escribe a ${email}`,
    secured: 'Los pagos los procesa Stripe',
    invalid: 'Este enlace de pago no funciona',
    invalidDetail:
      'Puede que haya caducado o se haya cerrado. Pide uno nuevo a quien te lo envió.',
    keep: 'Guarda tus facturas',
    keepDetail: (issuer: string) =>
      `Consulta todas las facturas de ${issuer || 'este emisor'} en un solo sitio, cuando quieras.`,
    kept: 'Esta factura está en tu cuenta.',
    allInvoices: 'Todas tus facturas',
  },
} satisfies Record<Language, Record<string, unknown>>;

export type Words = (typeof words)[Language];

const dates = {
  en: new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }),
  es: new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' }),
};

/** An ISO date as the invoice's language writes it. */
export const longDate = (language: Language, value: string) =>
  dates[language].format(new Date(`${value}T12:00:00Z`));

/**
 * A money formatter bound to the invoice's language and currency. A credit
 * takes a true minus sign, the width of a digit, not the hyphen Intl writes.
 */
export const moneyOf =
  (invoice: Pick<CheckoutInvoice, 'language' | 'currency'>) =>
  (amount: string) =>
    formatMoney(amount, invoice.language, invoice.currency).replace(
      '-',
      '\u2212',
    );

/**
 * Reads an amount the way people type it: "250", "250,5", "1.250,00",
 * "1,250.00". The last separator followed by one or two digits is the
 * decimal point; every other separator only groups thousands. Returns a
 * two-decimal string, or null for anything that is not an amount.
 */
export function readAmount(text: string): string | null {
  const compact = text.replace(/[\s €$£]/g, '');
  if (!/^\d[\d.,]*$/.test(compact)) return null;
  const decimal = compact.match(/[.,](\d{1,2})$/);
  const whole = (decimal ? compact.slice(0, decimal.index) : compact).replace(
    /[.,]/g,
    '',
  );
  if (!whole) return null;
  const cents = (decimal?.[1] ?? '').padEnd(2, '0');
  return `${BigInt(whole)}.${cents}`;
}

/** Minor units for a two-decimal amount, without floating-point drift. */
export const toCents = (amount: string) => {
  const [whole = '0', fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
};

export const fromCents = (cents: number) =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
