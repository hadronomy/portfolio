import type { RouteOwner } from '@portfolio/site-routing';
import {
  createRootRouteWithContext,
  ErrorComponent,
  type ErrorComponentProps,
  HeadContent,
  Outlet,
  redirect,
  Scripts,
  useRouterState,
} from '@tanstack/react-router';
// A plain import, not ?url: Start links it on the server for the first
// paint and Vite hot-updates it in development.
import '~/styles.css';
import { Hotkeys } from '~/lib/hotkeys';
import { InvoiceError } from '~/routes/-invoice-error';

export const Route = createRootRouteWithContext<{
  ownerOf: (pathname: string) => RouteOwner;
}>()({
  beforeLoad: ({ context, location }) => {
    if (context.ownerOf(location.pathname) === 'astro')
      throw redirect({ href: location.href, reloadDocument: true });
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Experiments · Pablo Hernández' },
    ],
    scripts: [
      {
        children: `try { const theme = localStorage.getItem('theme'); if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme; } catch {}`,
      },
    ],
  }),
  errorComponent: function RootError(props: ErrorComponentProps) {
    const invoices = useRouterState({
      select: (state) => state.location.pathname.startsWith('/invoices'),
    });
    return invoices ? (
      <InvoiceError {...props} />
    ) : (
      <ErrorComponent {...props} />
    );
  },
  shellComponent: Document,
  component: () => (
    <Hotkeys>
      <Outlet />
    </Hotkeys>
  ),
  notFoundComponent: () => (
    <section>
      <h1>This experiment has no page here.</h1>
      <p>
        Check the address or return to <a href="/experiments">experiments</a>.
      </p>
    </section>
  ),
});

function Document({ children }: { children: React.ReactNode }) {
  const isInvoicesRoute = useRouterState({
    select: (state) => state.location.pathname.startsWith('/invoices'),
  });
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {isInvoicesRoute ? (
          children
        ) : (
          <div className="app-shell">
            <header>
              <a href="/">Pablo Hernández</a>
              <a href="/experiments">Experiments</a>
            </header>
            <main>{children}</main>
          </div>
        )}
        <Scripts />
      </body>
    </html>
  );
}
