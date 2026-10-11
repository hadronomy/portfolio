import type { Language } from '@portfolio/invoices/model';
import type { ReactNode } from 'react';

// What the customer's account pages say. Before sign-in they follow the
// browser's language; after it, the language the invoices are written in.
// Sentences that name an address take it as a node, so the page can set the
// address apart from the words around it.

export const accountWords = {
  en: {
    title: 'Your invoices',
    intro: 'Sign in with the email address your invoices are sent to.',
    unavailable:
      'Accounts are not open here yet. Your payment link still shows your invoice.',
    email: 'Email address',
    emailMissing: 'Enter the address your invoices are sent to.',
    send: 'Email me a code',
    sending: 'Sending…',
    sentTo: (email: ReactNode) => (
      <>If {email} has invoices here, a code is on its way.</>
    ),
    sendTo: (email: ReactNode) => <>We will send a code to {email}.</>,
    sent: (email: ReactNode) => <>We sent a code to {email}.</>,
    code: 'Code from the email',
    verifying: 'Checking the code…',
    verified: 'Signed in',
    resend: 'Send a new code',
    resendIn: (seconds: number) =>
      `New code in 0:${String(seconds).padStart(2, '0')}`,
    resent: 'A new code is on its way.',
    other: 'Use another address',
    wrong: 'That code is not right. Check the newest email.',
    expired: 'That code expired. Send a new one.',
    tooMany: 'Too many tries. Send a new code.',
    slowDown: 'Too many requests. Wait a minute and try again.',
    closed: 'This address has no invoice with an open payment link.',
    failed: 'Something went wrong. Try again.',
    signOut: 'Sign out',
    toPay: 'To pay',
    overdueTotal: 'Overdue',
    settled: 'Nothing to pay',
    allPaid: 'Every invoice is settled. Thank you.',
    empty: (email: ReactNode) => (
      <>
        No invoices yet. Invoices billed to {email} appear here once they are
        issued.
      </>
    ),
    paid: 'Paid',
    due: (date: string) => `Due ${date}`,
    overdue: (date: string) => `Was due ${date}`,
    next: (amount: string, date: string) => `${amount} due ${date}`,
    nextLate: (amount: string, date: string) => `${amount} was due ${date}`,
    part: (index: number, of: number) => `${index} of ${of}`,
    nextPayment: 'Next payment',
    latePayment: 'Overdue payment',
    dueOn: (date: string) => `due ${date}`,
    overdueOn: (date: string) => `was due ${date}`,
    pay: 'Pay',
    open: (invoice: string) => `Open invoice ${invoice}`,
    pdf: (number: string) => `Download invoice ${number} as a PDF`,
    toPayGroup: 'To pay',
    paidGroup: 'Paid',
    missing: 'This invoice is not in your account',
    missingDetail:
      'It may be billed to another address. Your invoices are all in the list.',
    allInvoices: 'All your invoices',
    back: 'hadronomy',
  },
  es: {
    title: 'Tus facturas',
    intro: 'Entra con el correo al que te envían las facturas.',
    unavailable:
      'Las cuentas aún no están abiertas. Tu enlace de pago sigue mostrando tu factura.',
    email: 'Correo electrónico',
    emailMissing: 'Escribe el correo al que te envían las facturas.',
    send: 'Envíame un código',
    sending: 'Enviando…',
    sentTo: (email: ReactNode) => (
      <>Si {email} tiene facturas aquí, te llega un código.</>
    ),
    sendTo: (email: ReactNode) => <>Te enviaremos un código a {email}.</>,
    sent: (email: ReactNode) => <>Te hemos enviado un código a {email}.</>,
    code: 'Código del correo',
    verifying: 'Comprobando el código…',
    verified: 'Has entrado',
    resend: 'Enviar otro código',
    resendIn: (seconds: number) =>
      `Otro código en 0:${String(seconds).padStart(2, '0')}`,
    resent: 'Te llega un código nuevo.',
    other: 'Usar otro correo',
    wrong: 'Ese código no es correcto. Mira el correo más reciente.',
    expired: 'Ese código ha caducado. Pide otro.',
    tooMany: 'Demasiados intentos. Pide otro código.',
    slowDown: 'Demasiadas solicitudes. Espera un minuto y vuelve a probar.',
    closed:
      'Este correo no tiene ninguna factura con un enlace de pago abierto.',
    failed: 'Algo ha fallado. Vuelve a probar.',
    signOut: 'Salir',
    toPay: 'Por pagar',
    overdueTotal: 'Vencido',
    settled: 'Nada por pagar',
    allPaid: 'Todas las facturas están pagadas. Gracias.',
    empty: (email: ReactNode) => (
      <>
        Aún no hay facturas. Las facturas a nombre de {email} aparecen aquí
        cuando se emiten.
      </>
    ),
    paid: 'Pagada',
    due: (date: string) => `Vence el ${date}`,
    overdue: (date: string) => `Venció el ${date}`,
    next: (amount: string, date: string) => `${amount}, vence el ${date}`,
    nextLate: (amount: string, date: string) => `${amount}, venció el ${date}`,
    part: (index: number, of: number) => `${index} de ${of}`,
    nextPayment: 'Próximo pago',
    latePayment: 'Pago vencido',
    dueOn: (date: string) => `vence el ${date}`,
    overdueOn: (date: string) => `venció el ${date}`,
    pay: 'Pagar',
    open: (invoice: string) => `Abrir la factura ${invoice}`,
    pdf: (number: string) => `Descargar la factura ${number} en PDF`,
    toPayGroup: 'Por pagar',
    paidGroup: 'Pagadas',
    missing: 'Esta factura no está en tu cuenta',
    missingDetail:
      'Puede que esté a nombre de otro correo. Todas tus facturas están en la lista.',
    allInvoices: 'Todas tus facturas',
    back: 'hadronomy',
  },
} satisfies Record<Language, unknown>;

export type AccountWords = (typeof accountWords)[Language];
