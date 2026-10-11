import { ATPROTO_CALLBACK_ERRORS } from '@portfolio/auth-atproto/client';
import {
  Link,
  Outlet,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  FileText,
  LogOut,
  Package,
  Plus,
  Settings2,
  Users,
} from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { type ReactNode, useCallback, useState } from 'react';
import { authClient } from '../auth/client';
import { ownerHandle } from '../auth/shared';
import { coverArt } from './covers';
import { ToastProvider, useToast } from './toast';
import { Button, MorphText, Tip, TooltipProvider } from './ui';
import { useCreateInvoice, WorkspaceProvider } from './workspace';
// Imported here, with the workspace, rather than in the route file: the
// route's component code is split into its own chunk, so the styles ship
// with the invoice pages and nowhere else. A plain import lets Start link
// it for the first paint and Vite hot-update it in development.
import './invoices.css';

// What the callback's `?error=` means, in words the owner can act on.
const signInErrors: Record<string, string> = {
  not_owner: `That account does not own this workspace. Sign in as ${ownerHandle}.`,
  [ATPROTO_CALLBACK_ERRORS.ACCESS_DENIED]: 'Sign-in was cancelled.',
  [ATPROTO_CALLBACK_ERRORS.STATE_MISMATCH]:
    'That sign-in started in another browser or expired. Start again.',
};

function SignInScreen() {
  const callbackError = useRouterState({
    select: (state) => (state.location.search as Record<string, unknown>).error,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(
    typeof callbackError === 'string'
      ? (signInErrors[callbackError] ?? 'Sign-in failed. Try again.')
      : '',
  );
  const signIn = async () => {
    setPending(true);
    setError('');
    const { error } = await authClient.signIn.atproto({
      handle: ownerHandle,
      callbackURL: '/invoices',
      errorCallbackURL: '/invoices',
    });
    // Success leaves the page for the account's authorization screen.
    if (error) {
      setPending(false);
      setError(error.message ?? 'Sign-in failed. Try again.');
    }
  };
  // Plain anchors, not TanStack Link: '/' is the portfolio site outside this
  // router (same as routes/__root.tsx). Link to='/' fails tsc and 404s.
  return (
    <div className="iv-signin">
      <div className="iv-backdrop" aria-hidden>
        <img src={coverArt.ember.backdrop} alt="" />
      </div>
      <a href="/" className="iv-signin-back">
        <ArrowLeft size={15} /> hadronomy
      </a>
      <main className="iv-signin-card">
        <span className="iv-rail-mark" aria-hidden>
          h<span>/</span>
        </span>
        <h1>Invoices</h1>
        <p>Your invoices, customers, and records in one private workspace.</p>
        <Button variant="primary" disabled={pending} onClick={signIn}>
          <MorphText>
            {pending ? 'Connecting…' : 'Continue with AT Protocol'}
          </MorphText>
          <ArrowUpRight size={15} />
        </Button>
        {/* The answer sits under the button that asked the question. */}
        {error && (
          <p className="iv-signin-error" role="alert">
            {error}
          </p>
        )}
        <small>Private access · {ownerHandle}</small>
        <a className="iv-signin-alt" href="/invoices/account">
          <span>Billed by Hadronomy?</span>
          <span>
            See your invoices
            <ArrowRight size={14} aria-hidden />
          </span>
        </a>
      </main>
    </div>
  );
}

function RailLink({
  to,
  label,
  exact = false,
  current = false,
  children,
}: {
  to:
    | '/invoices'
    | '/invoices/customers'
    | '/invoices/items'
    | '/invoices/settings';
  label: string;
  exact?: boolean;
  /** Marks the link as the current section even when the route is deeper. */
  current?: boolean;
  children: ReactNode;
}) {
  return (
    <Tip label={label} side="right">
      <Link
        to={to}
        activeOptions={{ exact }}
        aria-label={label}
        className="iv-rail-item"
        data-current={current}
      >
        {children}
      </Link>
    </Tip>
  );
}

function Rail({
  pending,
  onSignOut,
}: {
  pending: boolean;
  onSignOut: () => void;
}) {
  const { create, pending: creating, ready } = useCreateInvoice();
  const toast = useToast();
  // An open invoice still belongs to the invoices section. Matching the id's
  // UUID shape keeps /invoices/customers and /invoices/items out of it, which
  // a fuzzy route match or the $invoiceId pattern would both let in.
  const inInvoice = useRouterState({
    select: (state) =>
      /^\/invoices\/[0-9a-f-]{36}$/i.test(state.location.pathname),
  });
  return (
    <nav className="iv-rail" aria-label="Invoice workspace">
      <a href="/" className="iv-rail-mark" aria-label="Back to portfolio">
        h<span>/</span>
      </a>
      <Tip label="New invoice" side="right">
        <button
          type="button"
          className="iv-rail-create"
          aria-label="New invoice"
          disabled={creating || !ready}
          onClick={async () => {
            if (!(await create()))
              toast('The draft could not be created. Try again.', 'error');
          }}
        >
          <Plus size={18} strokeWidth={2.2} />
        </button>
      </Tip>
      <RailLink to="/invoices" label="Invoices" exact current={inInvoice}>
        <FileText size={18} />
      </RailLink>
      <RailLink to="/invoices/customers" label="Customers">
        <Users size={18} />
      </RailLink>
      <RailLink to="/invoices/items" label="Items">
        <Package size={18} />
      </RailLink>
      <div className="iv-rail-spacer" />
      <RailLink to="/invoices/settings" label="Settings">
        <Settings2 size={18} />
      </RailLink>
      <Tip label="Sign out" side="right">
        <button
          type="button"
          className="iv-rail-item"
          aria-label="Sign out"
          disabled={pending}
          onClick={onSignOut}
        >
          <LogOut size={17} />
        </button>
      </Tip>
    </nav>
  );
}

export function InvoiceShell({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const signOut = useCallback(async () => {
    setPending(true);
    setError('');
    const { error } = await authClient.signOut();
    if (error) setError('Sign-out failed. Try again.');
    else await router.invalidate();
    setPending(false);
  }, [router]);
  if (!signedIn) return <SignInScreen />;
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <WorkspaceProvider>
          <ToastProvider>
            <div className="iv-app">
              <Rail pending={pending} onSignOut={signOut} />
              <div className="iv-main">
                {error && (
                  <div className="iv-banner" role="alert">
                    <MorphText>{error}</MorphText>
                  </div>
                )}
                <Outlet />
              </div>
            </div>
          </ToastProvider>
        </WorkspaceProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
