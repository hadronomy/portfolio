import { createFileRoute } from '@tanstack/react-router';
import { Auth } from '~/server/auth.server';
import { serve } from '~/server/runtime.server';

const handle = ({ request }: { request: Request }) =>
  serve(
    Auth.use((auth) => auth.handle(request)),
    request,
  );

export const Route = createFileRoute('/invoices_/auth/$')({
  server: { handlers: { GET: handle, POST: handle } },
});
