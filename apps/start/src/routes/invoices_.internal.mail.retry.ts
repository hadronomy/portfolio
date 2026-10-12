import { createFileRoute } from '@tanstack/react-router';
import { retryDueMail } from '../server/mail-retry.server';
import { serve } from '../server/runtime.server';

export const Route = createFileRoute('/invoices_/internal/mail/retry')({
  server: { handlers: { POST: ({ request }) => serve(retryDueMail, request) } },
});
