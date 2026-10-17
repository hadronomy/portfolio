import { formatMoney } from '@portfolio/invoices/calculate';
import { useLiveQuery } from '@tanstack/react-db';
import { useHotkey } from '@tanstack/react-hotkeys';
import { Link } from '@tanstack/react-router';
import { Plus, Search } from 'lucide-react';
import { type KeyboardEvent, useMemo, useRef, useState } from 'react';
import { documentStatus, today } from '~/features/invoices/status';
import { useToast } from '~/features/invoices/toast';
import {
  Button,
  MorphText,
  Segmented,
  StatusChip,
} from '~/features/invoices/ui';
import { useCreateInvoice, useWorkspace } from '~/features/invoices/workspace';
import { appHotkeys } from '~/lib/hotkeys';

type Filter = 'all' | 'draft' | 'open' | 'paid';

const FILTERS: ReadonlyArray<readonly [Filter, string]> = [
  ['all', 'All'],
  ['draft', 'Drafts'],
  ['open', 'Open'],
  ['paid', 'Paid'],
];

const emptyFilter: Record<Exclude<Filter, 'all'>, string> = {
  draft: 'No drafts',
  open: 'Nothing waiting for payment',
  paid: 'No paid invoices yet',
};

const kindLabel = {
  invoice: 'Invoice',
  rectification: 'Rectifying invoice',
  quote: 'Quote',
} as const;

const shortDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const day = (value: string) => shortDate.format(new Date(`${value}T12:00:00Z`));

/** Moves focus between row links with the arrow keys, like a list box. */
function onRowsKey(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const links = [
    ...event.currentTarget.querySelectorAll<HTMLAnchorElement>('.iv-row-link'),
  ];
  const at = links.indexOf(document.activeElement as HTMLAnchorElement);
  const next = links[at + (event.key === 'ArrowDown' ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

export function InvoiceList() {
  const { workspace, invoices, isError, refetch } = useWorkspace();
  const { data = [] } = useLiveQuery((query) =>
    query
      .from({ invoice: invoices })
      .orderBy(({ invoice }) => invoice.updatedAt, 'desc'),
  );
  const { create, pending, ready } = useCreateInvoice();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  // Typing in a field keeps its "/": a single key never fires from one.
  useHotkey(appHotkeys['documents.search'], () => searchRef.current?.focus());

  const on = useMemo(() => today(), []);
  const documents = useMemo(() => {
    const payments = workspace?.payments ?? [];
    const responses = workspace?.responses ?? {};
    return data.map((invoice) => ({
      invoice,
      ...documentStatus(invoice, payments, responses, on),
    }));
  }, [data, workspace, on]);

  const stats = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    let overdueCount = 0;
    let open = 0;
    for (const item of documents) {
      if (item.status === 'unpaid' || item.status === 'overdue') {
        outstanding += Number(item.remaining);
        open += 1;
      }
      if (item.status === 'overdue') {
        overdue += Number(item.remaining);
        overdueCount += 1;
      }
    }
    return {
      outstanding,
      overdue,
      overdueCount,
      open,
      drafts: documents.filter((item) => item.status === 'draft').length,
    };
  }, [documents]);

  const query = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      documents.filter(({ invoice, status }) => {
        const matches =
          filter === 'all' ||
          (filter === 'draft' && status === 'draft') ||
          (filter === 'open' &&
            (status === 'unpaid' || status === 'overdue')) ||
          (filter === 'paid' && status === 'paid');
        return (
          matches &&
          `${invoice.number ?? ''} ${invoice.data.customer.name} ${invoice.data.title}`
            .toLowerCase()
            .includes(query)
        );
      }),
    [documents, filter, query],
  );

  async function onCreate() {
    if (!(await create()))
      toast('The draft could not be created. Try again.', 'error');
  }

  return (
    <div className="iv-page">
      <header className="iv-page-head">
        <h1>
          Invoices
          <small>
            <MorphText>{`${data.length} document${data.length === 1 ? '' : 's'}`}</MorphText>
          </small>
        </h1>
        <div className="iv-page-actions">
          <label className="iv-search iv-hide-narrow">
            <Search size={15} />
            <input
              ref={searchRef}
              aria-label="Search invoices"
              placeholder="Search number or customer"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearch('');
                  event.currentTarget.blur();
                }
              }}
            />
            <kbd className="iv-kbd">/</kbd>
          </label>
          <Button
            variant="primary"
            disabled={pending || !ready}
            onClick={onCreate}
          >
            <Plus size={16} />
            New invoice
          </Button>
        </div>
      </header>

      <section className="iv-card iv-stats" aria-label="Summary">
        <div className="iv-stat">
          <span>Outstanding</span>
          <strong>
            <MorphText>
              {formatMoney(stats.outstanding.toFixed(2), 'en', 'EUR')}
            </MorphText>
          </strong>
          <small>
            <MorphText>{`${stats.open} open invoice${stats.open === 1 ? '' : 's'}`}</MorphText>
          </small>
        </div>
        <div className="iv-stat">
          <span>Overdue</span>
          <strong>
            <MorphText>
              {formatMoney(stats.overdue.toFixed(2), 'en', 'EUR')}
            </MorphText>
          </strong>
          <small>
            <MorphText>
              {stats.overdueCount
                ? `${stats.overdueCount} past due`
                : 'Nothing past due'}
            </MorphText>
          </small>
        </div>
        <div className="iv-stat">
          <span>Drafts</span>
          <strong>
            <MorphText>{String(stats.drafts)}</MorphText>
          </strong>
          <small>Not issued yet</small>
        </div>
      </section>

      <div className="iv-toolbar">
        <Segmented
          label="Filter invoices"
          value={filter}
          onChange={setFilter}
          options={FILTERS}
        />
      </div>

      {isError && (
        <div className="iv-banner" role="alert">
          The workspace could not load.
          <Button size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {/* biome-ignore lint/a11y/noStaticElementInteractions: the rows are
          focusable links; this only moves focus between them with arrows. */}
      <div
        className="iv-card iv-rows"
        data-list="invoices"
        onKeyDown={onRowsKey}
      >
        {rows.length > 0 && (
          <div className="iv-row-head" aria-hidden>
            <span>Document</span>
            <span>Customer</span>
            <span className="iv-hide-narrow">Issued</span>
            <span className="iv-hide-narrow">Due</span>
            <span>Status</span>
            <span className="iv-end">Amount</span>
          </div>
        )}
        {rows.map(({ invoice, status, total }) => {
          const name =
            invoice.number ?? (invoice.data.title || 'Untitled draft');
          return (
            <div className="iv-row" key={invoice.id}>
              <Link
                to="/invoices/$invoiceId"
                params={{ invoiceId: invoice.id }}
                className="iv-row-link"
                aria-label={`${name}, ${invoice.data.customer.name || 'no customer'}`}
              />
              <div>
                <strong>{name}</strong>
                <small>
                  {invoice.number && invoice.data.title
                    ? invoice.data.title
                    : kindLabel[invoice.data.kind]}
                </small>
              </div>
              <span className="iv-muted">
                {invoice.data.customer.name || 'No customer yet'}
              </span>
              <span className="iv-muted iv-num iv-hide-narrow">
                {day(invoice.data.issueDate)}
              </span>
              <span className="iv-muted iv-num iv-hide-narrow">
                {day(invoice.data.dueDate)}
              </span>
              <span>
                <StatusChip status={status} />
              </span>
              <strong className="iv-end iv-num">
                <MorphText>
                  {formatMoney(
                    total,
                    invoice.data.language,
                    invoice.data.currency,
                  )}
                </MorphText>
              </strong>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="iv-empty">
            <h2>
              {query
                ? 'No matching invoices'
                : filter === 'all'
                  ? 'No invoices yet'
                  : emptyFilter[filter]}
            </h2>
            <p>
              {query
                ? 'Try another customer name or document number.'
                : filter === 'all'
                  ? 'Start a draft, add the work, and issue it when it is ready.'
                  : 'Documents appear here as their status changes.'}
            </p>
            {!query && filter === 'all' && (
              <Button
                variant="primary"
                disabled={pending || !ready}
                onClick={onCreate}
              >
                <Plus size={16} />
                New invoice
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
