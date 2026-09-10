import { Link, Outlet, useRouter } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  LogOut,
  Package,
  Settings2,
  Users,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { beginSignIn, endSignIn } from './api';
import { Morph } from './ui';
import { WorkspaceProvider } from './workspace';

function SignInScreen({
  pending,
  error,
  onSignIn,
}: {
  pending: boolean;
  error: string;
  onSignIn: () => void;
}) {
  // Plain anchors, not TanStack Link: '/' is the portfolio site outside this
  // router (same as routes/__root.tsx). Link to='/' fails tsc and 404s.
  return (
    <div className="iv-app iv-signin">
      <a href="/" className="iv-back">
        <ArrowLeft size={16} /> hadronomy
      </a>
      <div className="iv-signin-content">
        <div className="iv-wordmark">
          Invoices<span> / </span>
        </div>
        <h1>
          A little order.
          <br />
          For the work you do.
        </h1>
        <p>Your invoices, customers, and records in one private workspace.</p>
        <button className="iv-primary" disabled={pending} onClick={onSignIn}>
          <Morph>{pending ? 'Connecting…' : 'Sign in with AT Protocol'}</Morph>
          <ArrowUpRight size={18} />
        </button>
        <span className="iv-signin-owner">Private access · hadronomy.com</span>
        {error && (
          <p role="alert">
            <Morph>{error}</Morph>
          </p>
        )}
      </div>
      <div className="iv-signin-foot">
        Made for independent work.<span>Canary Islands · EN / ES</span>
      </div>
    </div>
  );
}

function Rail({
  pending,
  onSignOut,
}: {
  pending: boolean;
  onSignOut: () => void;
}) {
  return (
    <nav className="iv-rail" aria-label="Invoice workspace">
      <a href="/" className="iv-mark" aria-label="Back to portfolio">
        h<span>/</span>
      </a>
      <Link
        to="/invoices"
        activeOptions={{ exact: true }}
        aria-label="Invoices"
        title="Invoices"
      >
        <FileText size={21} />
      </Link>
      <Link to="/invoices/customers" aria-label="Customers" title="Customers">
        <Users size={21} />
      </Link>
      <Link to="/invoices/items" aria-label="Items" title="Items">
        <Package size={21} />
      </Link>
      <div className="iv-rail-spacer" />
      <Link to="/invoices/settings" aria-label="Settings" title="Settings">
        <Settings2 size={21} />
      </Link>
      <button
        aria-label="Sign out"
        title="Sign out"
        disabled={pending}
        onClick={onSignOut}
      >
        <LogOut size={19} />
      </button>
    </nav>
  );
}

export function InvoiceShell({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const authenticate = useCallback(async () => {
    setPending(true);
    setError('');
    try {
      if (signedIn) {
        await endSignIn();
        await router.invalidate();
      } else {
        window.location.assign(await beginSignIn());
      }
    } catch (_error: unknown) {
      // [shell:auth] sign-in/out failed; the toast carries the message.
      setError('Sign-in failed. Try again.');
    } finally {
      setPending(false);
    }
  }, [router, signedIn]);
  if (!signedIn)
    return (
      <SignInScreen pending={pending} error={error} onSignIn={authenticate} />
    );
  return (
    <WorkspaceProvider>
      <div className="iv-app">
        <Rail pending={pending} onSignOut={authenticate} />
        <div className="iv-workspace">
          <Outlet />
        </div>
        {error && (
          <div className="iv-toast" role="alert">
            <Morph>{error}</Morph>
          </div>
        )}
      </div>
    </WorkspaceProvider>
  );
}
