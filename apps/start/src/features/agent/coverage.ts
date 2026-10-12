import type { Mutation } from '../invoices/api';
import type { ToolName } from './tools';

// What the owner can do, and how an agent does the same. The type checker
// holds the first map complete: a new kind of workspace edit does not
// compile until a tool covers it. The second covers every server function,
// and coverage.test.ts fails when one appears without an entry.

/** Each edit the invoice pages make, and the tools that make it for an agent. */
export const toolsForEdits = {
  save: ['create_draft', 'update_draft'],
  issue: ['issue_document'],
  remove: ['delete_draft'],
  rectify: ['rectify_invoice'],
  customer: ['save_customer'],
  item: ['save_catalog_item'],
  preferences: ['save_settings'],
  forget: ['forget_customer', 'forget_catalog_item'],
  payment: ['record_payment'],
  'reverse-payment': ['reverse_payment'],
  offer: ['set_payment_plans'],
  choose: ['choose_payment_plan'],
  library: ['save_plan_library'],
  revise: ['revise_quote'],
  bill: ['bill_quote_payment'],
} as const satisfies Record<Mutation['action'], readonly ToolName[]>;

/**
 * Every server function, and how an agent reaches what it does: the tools
 * that cover it, or why no tool should. Customers' pages and the browser's
 * own plumbing are not the owner's work, so agents do not get them.
 */
export const serverFunctions: Record<
  string,
  readonly ToolName[] | { readonly notForAgents: string }
> = {
  getViewer: { notForAgents: 'An agent knows it acts for the owner.' },
  getWorkspace: [
    'list_documents',
    'get_document',
    'list_customers',
    'list_catalog',
    'get_settings',
  ],
  mutateWorkspace: Object.values(toolsForEdits).flat(),
  previewInvoice: ['get_document'],
  findAddresses: { notForAgents: 'Typing help for the address form.' },
  findLocality: { notForAgents: 'Typing help for the address form.' },
  getCollection: ['get_document'],
  sharePaymentLink: ['share_payment_link'],
  revokePaymentLinks: ['close_payment_links'],
  beginPayment: { notForAgents: 'The customer pays.' },
  getCheckout: { notForAgents: 'The customer’s payment page.' },
  shareQuoteLink: ['send_quote'],
  revokeQuoteLinks: ['close_quote_links'],
  getQuoteLinks: ['get_document'],
  emailQuoteLink: ['email_quote'],
  previewQuoteEmail: {
    notForAgents:
      'How the email looks, for the owner’s compose dialog; email_quote returns what went out.',
  },
  getQuoteEmails: ['get_document'],
  getQuoteDeliveries: ['get_document'],
  retryEmail: ['retry_email'],
  getQuotePage: { notForAgents: 'The customer’s quote page.' },
  answerQuoteLink: { notForAgents: 'The customer answers a quote.' },
  getPrivacyNotice: { notForAgents: 'Public customer privacy information.' },
  getAccountPage: { notForAgents: 'The customer’s account.' },
  getAccountInvoice: { notForAgents: 'The customer’s account.' },
  fingerprint: { notForAgents: 'Browser plumbing.' },
  getAgents: { notForAgents: 'An agent does not manage who may connect.' },
  disconnectAgent: {
    notForAgents: 'An agent does not manage who may connect.',
  },
};
