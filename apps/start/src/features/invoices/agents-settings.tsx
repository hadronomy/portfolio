import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { disconnectAgent } from '~/features/invoices/api';
import { invoiceQueries } from '~/features/invoices/queries';
import { Button, MorphText } from '~/features/invoices/ui';

// The agents the owner let in over MCP, in Settings. Each row names the
// agent and its site, and disconnects it on a second press: a first press
// only arms the button, so no single slip shuts an agent out.

const connectedOn = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function Endpoint({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="iv-share-link">
      <input
        readOnly
        value={url}
        aria-label="MCP address"
        onFocus={(event) => event.currentTarget.select()}
      />
      <Button
        size="sm"
        variant={copied ? 'ghost' : 'secondary'}
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <MorphText>{copied ? 'Copied' : 'Copy'}</MorphText>
      </Button>
    </div>
  );
}

function Disconnect({ clientId }: { clientId: string }) {
  const client = useQueryClient();
  const [armed, setArmed] = useState(false);
  const drop = useMutation({
    mutationFn: () => disconnectAgent({ data: { clientId } }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: invoiceQueries.agents().queryKey }),
  });
  // An armed button disarms itself if the owner looks away.
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return (
    <Button
      size="sm"
      variant={armed ? 'danger' : 'ghost'}
      disabled={drop.isPending}
      onClick={() => (armed ? drop.mutate() : setArmed(true))}
    >
      <MorphText>{armed ? 'Disconnect now' : 'Disconnect'}</MorphText>
    </Button>
  );
}

export function AgentsSettings() {
  const { data } = useQuery(invoiceQueries.agents());
  if (!data) return <p className="iv-muted">Loading agents…</p>;
  return (
    <div className="iv-agents">
      {data.agents.length > 0 ? (
        <ul>
          {data.agents.map((agent) => (
            <li key={agent.clientId}>
              <div>
                <strong>{agent.name ?? agent.site ?? 'An agent'}</strong>
                <span>
                  {[
                    agent.site,
                    agent.connectedAt &&
                      `Connected ${connectedOn.format(new Date(agent.connectedAt))}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <Disconnect clientId={agent.clientId} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="iv-muted">No agent is connected.</p>
      )}
      <div className="iv-agents-connect">
        <span className="iv-label">Connect an agent with this address</span>
        <Endpoint url={data.endpoint} />
      </div>
    </div>
  );
}
