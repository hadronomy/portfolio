import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/invoices_/auth/jwks.json')({
  server: {
    handlers: {
      GET: async () => {
        const { oauthClient } = await import(
          '../features/invoices/auth.server'
        );
        return Response.json((await oauthClient()).jwks);
      },
    },
  },
});
