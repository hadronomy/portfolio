import { balance, calculate, formatMoney } from '@portfolio/invoices/calculate';
import type { Invoice, Payment } from '@portfolio/invoices/model';
import { newInvoice } from '@portfolio/invoices/model';
import { useLiveQuery } from '@tanstack/react-db';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, FilePlus2, Plus, Search } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';
import { Morph } from './ui';
import { useWorkspace } from './workspace';

type Filter = 'all' | 'draft' | 'issued';

const FILTERS: ReadonlyArray<readonly [Filter, string]> = [
  ['all', 'All documents'],
  ['draft', 'Drafts'],
  ['issued', 'Issued'],
];

function invoiceStatus(
  invoice: Invoice,
  remaining: string,
  today: string,
): string {
  if (invoice.status === 'draft') return 'Draft';
  if (invoice.data.kind === 'proforma') return 'Proforma';
  if (Number(remaining) <= 0) return 'Paid';
  if (invoice.data.dueDate < today) return 'Overdue';
  return 'Unpaid';
}

export function InvoiceList() {
  const { workspace, invoices, mutate, isError, refetch } = useWorkspace();
  const { data = [] } = useLiveQuery((query) =>
    query
      .from({ invoice: invoices })
      .orderBy(({ invoice }) => invoice.updatedAt, 'desc'),
  );
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function create() {
    if (!workspace) return;
    setPending(true);
    setError('');
    try {
      const invoice = newInvoice(workspace.preferences);
      const result = await mutate({ action: 'save', invoice });
      if (!result.ok) throw new Error('The draft could not be saved.');
      await navigate({
        to: '/invoices/$invoiceId',
        params: { invoiceId: invoice.id },
      });
    } catch {
      setError('The draft could not be saved. Try again.');
    } finally {
      setPending(false);
    }
  }
  const payments = useMemo(() => workspace?.payments ?? [], [workspace]);
  const query = search.toLowerCase();
  const rows = useMemo(
    () =>
      data.filter(
        (invoice) =>
          (filter === 'all' || invoice.status === filter) &&
          `${invoice.number ?? ''} ${invoice.data.customer.name} ${invoice.data.title}`
            .toLowerCase()
            .includes(query),
      ),
    [data, filter, query],
  );
  const issued = useMemo(
    () =>
      data.filter(
        (invoice) =>
          invoice.status === 'issued' && invoice.data.kind !== 'proforma',
      ),
    [data],
  );
  const drafts = useMemo(
    () => data.filter((invoice) => invoice.status === 'draft').length,
    [data],
  );
  const outstanding = useMemo(
    () =>
      issued.reduce(
        (sum, invoice) =>
          sum +
          Number(
            balance(
              calculate(invoice.data).total,
              payments.filter(
                (payment: Payment) => payment.invoiceId === invoice.id,
              ),
            ),
          ),
        0,
      ),
    [issued, payments],
  );
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  function onFilterKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const order: Filter[] = ['all', 'draft', 'issued'];
    const at = order.indexOf(filter);
    const next =
      order[
        (at + (event.key === 'ArrowRight' ? 1 : order.length - 1)) %
          order.length
      ];
    if (next) setFilter(next);
  }
  return (
    <div className="iv-index">
      <header className="iv-topbar">
        <div className="iv-breadcrumb">
          Workspace<span>/</span>Invoices
        </div>
        <span className="iv-account">hadronomy.com</span>
      </header>
      <section className="iv-list-heading">
        <div>
          <h1>Invoices</h1>
          <p>A record of your work.</p>
        </div>
        <button
          className="iv-primary"
          disabled={pending || !workspace}
          onClick={create}
        >
          <Plus size={17} />
          {pending ? 'Creating…' : 'New invoice'}
        </button>
      </section>
      <div className="iv-overview">
        <div>
          <span>Outstanding</span>
          <strong>
            <Morph>{formatMoney(String(outstanding), 'en', 'EUR')}</Morph>
          </strong>
        </div>
        <div>
          <span>Issued invoices</span>
          <strong>
            <Morph>{issued.length}</Morph>
          </strong>
        </div>
        <div>
          <span>Drafts</span>
          <strong>
            <Morph>{drafts}</Morph>
          </strong>
        </div>
      </div>
      <div className="iv-list-tools">
        <div
          className="iv-tabs"
          role="tablist"
          aria-label="Filter invoices"
          onKeyDown={onFilterKey}
        >
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              tabIndex={filter === value ? 0 : -1}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="iv-search">
          <Search size={16} />
          <input
            aria-label="Search invoices"
            placeholder="Search invoices…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      {(isError || error) && (
        <div className="iv-error" role="alert">
          {error || 'The workspace could not load.'}
          <button onClick={() => refetch()}>Try again</button>
        </div>
      )}
      {rows.length ? (
        <div className="iv-table-wrap">
          <table className="iv-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Customer</th>
                <th>Issued</th>
                <th>Status</th>
                <th className="iv-number">Amount</th>
                <th>
                  <span className="iv-sr">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((invoice) => {
                const total = calculate(invoice.data).total;
                const remaining = balance(
                  total,
                  payments.filter(
                    (payment: Payment) => payment.invoiceId === invoice.id,
                  ),
                );
                const status = invoiceStatus(invoice, remaining, today);
                return (
                  <tr key={invoice.id}>
                    <td>
                      <Link
                        to="/invoices/$invoiceId"
                        params={{ invoiceId: invoice.id }}
                      >
                        {invoice.number ??
                          (invoice.data.title || 'Untitled draft')}
                      </Link>
                      <small>
                        {invoice.data.kind === 'rectification'
                          ? 'Rectifying invoice'
                          : invoice.data.kind === 'proforma'
                            ? 'Proforma'
                            : 'Invoice'}
                      </small>
                    </td>
                    <td>{invoice.data.customer.name || 'No customer yet'}</td>
                    <td>{invoice.data.issueDate}</td>
                    <td>
                      <span
                        className={`iv-status iv-status-${status.toLowerCase()}`}
                      >
                        <Morph>{status}</Morph>
                      </span>
                    </td>
                    <td className="iv-number">
                      <Morph>
                        {formatMoney(
                          total,
                          invoice.data.language,
                          invoice.data.currency,
                        )}
                      </Morph>
                    </td>
                    <td>
                      <Link
                        to="/invoices/$invoiceId"
                        params={{ invoiceId: invoice.id }}
                        aria-label={`Open ${invoice.number ?? 'draft'}`}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="iv-empty">
          <FilePlus2 size={36} strokeWidth={1.2} />
          <h2>
            {search
              ? 'No matching invoices'
              : filter === 'issued'
                ? 'No issued invoices yet'
                : 'Your next project starts here'}
          </h2>
          <p>
            {search
              ? 'Try another customer or document number.'
              : 'Create a draft. Add the details. Make it official when it is ready.'}
          </p>
          {!search && filter !== 'issued' && (
            <button onClick={create} disabled={pending || !workspace}>
              Create your first invoice <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      )}
      <footer className="iv-list-footer">
        {`${rows.length} document${rows.length === 1 ? '' : 's'}`}
        <span>Private workspace · Canary Islands</span>
      </footer>
    </div>
  );
}
