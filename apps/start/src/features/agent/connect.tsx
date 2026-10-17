import { useRouterState } from '@tanstack/react-router';
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { step } from '~/features/agent/step';
import { authClient } from '~/features/auth/client';
import { agentScope, ownerHandle } from '~/features/auth/shared';
import { coverArt } from '~/features/invoices/covers';
import { Button, MorphText } from '~/features/invoices/ui';
import '~/features/invoices/invoices.css';

// Where the owner lets an agent in. An MCP client sends them here twice:
// first to sign in, then to approve it. The page names the agent and the
// site it comes from, says plainly what it may do, and leaves the choice
// with the owner. The signed request rides in the address; the provider's
// client plugin hands it back with every answer.

/** What a client says about itself, from its metadata document. */
interface Client {
  readonly client_id: string;
  readonly client_name?: string;
  readonly client_uri?: string;
  readonly logo_uri?: string;
}

const scopes: Record<string, string> = {
  [agentScope]:
    'Read and change everything in your invoices: drafts, quotes, customers, payments, links and settings.',
  offline_access: 'Stay connected until you disconnect it in Settings.',
  openid: 'Know that it is you who connected it.',
};

const hostOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
};

const search = () =>
  typeof window === 'undefined' ? '' : window.location.search;

/** The agent asking, as the provider knows it. */
function useClient() {
  const [client, setClient] = useState<Client | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(search()).get('client_id');
    if (!id) return;
    void authClient.oauth2
      .publicClientPrelogin({ client_id: id })
      .then(({ data }) => data && setClient(data as Client));
  }, []);
  return client;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="iv-signin">
      <div className="iv-backdrop" aria-hidden>
        <img src={coverArt.ember.backdrop} alt="" />
      </div>
      <a href="/invoices" className="iv-signin-back">
        <ArrowLeft size={15} /> Invoices
      </a>
      <main className="iv-signin-card iv-connect">{children}</main>
    </div>
  );
}

function Agent({ client }: { client: Client | null }) {
  const site = hostOf(client?.client_uri) ?? hostOf(client?.client_id);
  return (
    <div className="iv-connect-agent">
      {client?.logo_uri ? (
        <img src={client.logo_uri} alt="" width={40} height={40} />
      ) : (
        <span className="iv-connect-initial" aria-hidden>
          {(client?.client_name ?? site ?? '?').slice(0, 1).toUpperCase()}
        </span>
      )}
      <div>
        <strong>{client?.client_name ?? site ?? 'An agent'}</strong>
        {site && <small>{site}</small>}
      </div>
    </div>
  );
}

/** Sign-in for an agent's request: the owner proves who they are first. */
export function ConnectSignIn({ signedIn }: { signedIn: boolean }) {
  const client = useClient();
  const [pending, setPending] = useState(signedIn);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!signedIn) return;
    // Back from AT Protocol sign-in: the provider picks the request up
    // where it left it, and sends the browser on to approve the agent.
    void authClient.oauth2.continue({ selected: true }).then((answer) => {
      const next = step(answer);
      if (next.kind === 'leaving') return;
      setPending(false);
      setError(next.problem);
    });
  }, [signedIn]);
  const signIn = async () => {
    setPending(true);
    setError('');
    const back = `/invoices/connect${search()}`;
    const { error: failure } = await authClient.signIn.atproto({
      handle: ownerHandle,
      callbackURL: back,
      errorCallbackURL: back,
    });
    if (failure) {
      setPending(false);
      setError(failure.message ?? 'Sign-in failed. Try again.');
    }
  };
  return (
    <Frame>
      <Agent client={client} />
      <h1>Connect an agent</h1>
      <p>
        Sign in as the owner of these invoices. You will see what it asks for
        before anything is shared.
      </p>
      <Button variant="primary" disabled={pending} onClick={signIn}>
        <MorphText>
          {pending ? 'Connecting…' : 'Continue with AT Protocol'}
        </MorphText>
        <ArrowUpRight size={15} />
      </Button>
      {error && (
        <p className="iv-signin-error" role="alert">
          {error}
        </p>
      )}
      <small>Private access · {ownerHandle}</small>
    </Frame>
  );
}

/** Approval: what the agent may do, and the owner's yes or no. */
export function ConnectConsent({ owner }: { owner: boolean }) {
  const client = useClient();
  const [pending, setPending] = useState<'allow' | 'decline' | null>(null);
  const [error, setError] = useState('');
  // Read through the router, so the server renders the same list.
  const query = useRouterState({ select: (state) => state.location.searchStr });
  const asked = (new URLSearchParams(query).get('scope') ?? '')
    .split(' ')
    .filter((scope) => scope in scopes);
  const answer = async (accept: boolean) => {
    setPending(accept ? 'allow' : 'decline');
    setError('');
    const next = step(await authClient.oauth2.consent({ accept }));
    // The buttons stay disabled while the browser goes to the agent: a
    // second answer would send it a second code.
    if (next.kind === 'leaving') return;
    setPending(null);
    setError(next.problem);
  };
  if (!owner)
    return (
      <Frame>
        <h1>Only the owner can connect an agent</h1>
        <p>Sign in as {ownerHandle} to approve this request.</p>
        <a className="iv-btn" data-variant="primary" href="/invoices">
          <span>Go to sign-in</span>
        </a>
      </Frame>
    );
  return (
    <Frame>
      <Agent client={client} />
      <h1>Allow this agent into your invoices?</h1>
      <ul className="iv-connect-scopes">
        {asked.map((scope) => (
          <li key={scope}>
            <Check size={14} aria-hidden />
            <span>{scopes[scope]}</span>
          </li>
        ))}
      </ul>
      <p className="iv-connect-note">
        It acts as you. Issued invoices stay as the law needs them, and you can
        disconnect it at any time in Settings.
      </p>
      <div className="iv-connect-actions">
        <Button
          variant="primary"
          disabled={pending !== null}
          onClick={() => answer(true)}
        >
          <MorphText>{pending === 'allow' ? 'Allowing…' : 'Allow'}</MorphText>
        </Button>
        <Button
          variant="ghost"
          disabled={pending !== null}
          onClick={() => answer(false)}
        >
          <span>Decline</span>
        </Button>
      </div>
      {error && (
        <p className="iv-signin-error" role="alert">
          {error}
        </p>
      )}
    </Frame>
  );
}
