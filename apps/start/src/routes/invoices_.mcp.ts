import { createFileRoute } from '@tanstack/react-router';
import { answerAgent } from '~/features/agent/mcp.server';
import { Auth } from '~/server/auth.server';
import { serve } from '~/server/runtime.server';

// The MCP endpoint. Only a request with the owner's agent token reaches the
// server; any other gets the challenge that starts the client's sign-in.
const handle = ({ request }: { request: Request }) =>
  serve(
    Auth.use((auth) => auth.agent(request, answerAgent)),
    request,
  );

export const Route = createFileRoute('/invoices_/mcp')({
  server: { handlers: { GET: handle, POST: handle, DELETE: handle } },
});
