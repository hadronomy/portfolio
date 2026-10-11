import { createFileRoute } from '@tanstack/react-router';
import { Auth } from '../server/auth.server';
import { serve } from '../server/runtime.server';

// The discovery documents MCP clients read before they sign in. OAuth puts
// them at the site's root, outside /invoices/auth; anything else here is
// not ours.
const handle = ({ request }: { request: Request }) =>
  serve(
    Auth.use((auth) => auth.discovery(request)),
    request,
  ).then((response) => response ?? new Response('Not found', { status: 404 }));

export const Route = createFileRoute('/.well-known/$')({
  server: { handlers: { GET: handle } },
});
