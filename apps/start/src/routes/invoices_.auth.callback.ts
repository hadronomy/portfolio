import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/invoices_/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { callback } = await import('../features/invoices/auth.server');
        return callback(request);
      },
    },
  },
});
