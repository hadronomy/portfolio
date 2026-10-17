import { formatMoney } from '@portfolio/invoices/calculate';
import type { CatalogItem, Customer } from '@portfolio/invoices/model';
import {
  blankParty,
  CatalogItem as CatalogItemSchema,
  Customer as CustomerSchema,
  newLine,
  RecordId,
} from '@portfolio/invoices/model';
import { useLiveQuery } from '@tanstack/react-db';
import { useForm, useSelector } from '@tanstack/react-form';
import { Schema } from 'effect';
import { Plus, Search, Trash2 } from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useRef,
  useState,
} from 'react';
import {
  currencySymbol,
  customerTypes,
  igicRates,
  languages,
  lineKinds,
  territoryNames,
  treatments,
} from '~/features/invoices/choices';
import { PartyFields } from '~/features/invoices/party-fields';
import { AmountField, TerritorySelect } from '~/features/invoices/smart-fields';
import { useToast } from '~/features/invoices/toast';
import {
  Button,
  Field,
  IconButton,
  Modal,
  MorphText,
  Select,
} from '~/features/invoices/ui';
import { useWorkspace } from '~/features/invoices/workspace';

/** Replays a short horizontal shake on the form, the transitions.dev error cue (#12). */
function useShake() {
  const ref = useRef<HTMLFormElement>(null);
  const shake = () => {
    const form = ref.current;
    if (!form) return;
    form.classList.remove('iv-shake');
    void form.offsetWidth;
    form.classList.add('iv-shake');
  };
  return { ref, shake };
}

function FormShell({
  formRef,
  onSubmit,
  pending,
  error,
  onCancel,
  submitLabel,
  children,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  onSubmit: () => void;
  pending: boolean;
  error: string;
  onCancel: () => void;
  submitLabel: string;
  children: ReactNode;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <form
      ref={formRef}
      className="iv-stack"
      onSubmit={submit}
      onAnimationEnd={(event) =>
        event.currentTarget.classList.remove('iv-shake')
      }
    >
      {children}
      {error && (
        <p className="iv-banner" role="alert">
          {error}
        </p>
      )}
      <div className="iv-dialog-actions" style={{ marginTop: 8 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          <MorphText>{pending ? 'Saving…' : submitLabel}</MorphText>
        </Button>
      </div>
    </form>
  );
}

/** Arrow keys walk the rows, the same as the invoice list. */
function onRowsKey(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const rows = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('.iv-row-link'),
  ];
  const at = rows.indexOf(document.activeElement as HTMLButtonElement);
  const next = rows[at + (event.key === 'ArrowDown' ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

function DirectoryPage<T extends { id: string }>({
  title,
  noun,
  list,
  columns,
  figureLast = false,
  rows,
  search,
  empty,
  onAdd,
  onOpen,
  onRemove,
  renderRow,
  error,
}: {
  title: string;
  noun: string;
  list: 'customers' | 'items';
  columns: string[];
  /** Right-align the last column, for figures such as prices. */
  figureLast?: boolean;
  rows: readonly T[];
  search: (row: T) => string;
  empty: { title: string; body: string };
  onAdd: () => void;
  onOpen: (row: T) => void;
  onRemove: (row: T) => void;
  renderRow: (row: T) => { name: string; cells: ReactNode };
  error: string;
}) {
  const [query, setQuery] = useState('');
  const shown = rows.filter((row) =>
    search(row).toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="iv-page">
      <header className="iv-page-head">
        <h1>
          {title}
          <small>
            <MorphText>{`${rows.length} ${noun}${rows.length === 1 ? '' : 's'}`}</MorphText>
          </small>
        </h1>
        <div className="iv-page-actions">
          {rows.length > 0 && (
            <label className="iv-search iv-hide-narrow">
              <Search size={15} />
              <input
                aria-label={`Search ${title.toLowerCase()}`}
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          )}
          <Button variant="primary" onClick={onAdd}>
            <Plus size={16} />
            Add {noun}
          </Button>
        </div>
      </header>
      {error && (
        <div className="iv-banner" role="alert">
          <MorphText>{error}</MorphText>
        </div>
      )}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the rows are
          focusable links; this only moves focus between them with arrows. */}
      <div className="iv-card iv-rows" data-list={list} onKeyDown={onRowsKey}>
        {shown.length > 0 && (
          <div className="iv-row-head" aria-hidden>
            {columns.map((column, index) => (
              <span
                key={column}
                className={
                  figureLast && index === columns.length - 1
                    ? 'iv-end'
                    : undefined
                }
              >
                {column}
              </span>
            ))}
            <span />
          </div>
        )}
        {shown.map((row) => {
          const { name, cells } = renderRow(row);
          return (
            <div className="iv-row" key={row.id}>
              <button
                type="button"
                className="iv-row-link"
                aria-label={`Edit ${name}`}
                onClick={() => onOpen(row)}
              />
              {cells}
              <div className="iv-row-actions">
                <IconButton
                  label={`Delete ${name}`}
                  onClick={() => onRemove(row)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="iv-empty">
            <h2>{query ? `No ${noun} matches` : empty.title}</h2>
            <p>{query ? 'Try another name.' : empty.body}</p>
            {!query && (
              <Button variant="primary" onClick={onAdd}>
                <Plus size={16} />
                Add {noun}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmRemove({
  title,
  description,
  open,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!pending && !next) onClose();
      }}
      title={title}
      description={description}
    >
      <div className="iv-dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const done = await onConfirm();
            setPending(false);
            if (done) onClose();
          }}
        >
          <MorphText>{pending ? 'Deleting…' : 'Delete'}</MorphText>
        </Button>
      </div>
    </Modal>
  );
}

export function CustomerDirectory() {
  const { workspace, customers, mutate, isError } = useWorkspace();
  const live = useLiveQuery((query) => query.from({ customer: customers }));
  // Until the collection syncs, after hydration, the workspace the route
  // loaded has the same rows.
  const rows = live.isReady ? live.data : (workspace?.customers ?? []);
  const toast = useToast();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [removing, setRemoving] = useState<Customer | null>(null);
  const known = editing && rows.some((customer) => customer.id === editing.id);
  return (
    <>
      <DirectoryPage
        title="Customers"
        noun="customer"
        list="customers"
        columns={['Name', 'Contact', 'Territory']}
        rows={rows}
        search={(customer) =>
          `${customer.name} ${customer.taxId} ${customer.email} ${customer.address.locality}`
        }
        empty={{
          title: 'No customers yet',
          body: 'Save the people and businesses you bill. A new invoice fills in from them.',
        }}
        onAdd={() =>
          setEditing({
            ...blankParty,
            id: RecordId.make(crypto.randomUUID()),
            type: 'business',
            territory: 'canary-islands',
            language: 'en',
          })
        }
        onOpen={setEditing}
        onRemove={setRemoving}
        error={isError ? 'Customers could not load.' : ''}
        renderRow={(customer) => ({
          name: customer.name || 'Unnamed customer',
          cells: (
            <>
              <div>
                <strong>{customer.name || 'Unnamed customer'}</strong>
                <small>{customer.taxId || 'No tax ID'}</small>
              </div>
              <span className="iv-muted iv-hide-narrow">
                {[customer.email, customer.address.locality]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </span>
              <span className="iv-muted iv-hide-narrow">
                {territoryNames[customer.territory]}
              </span>
            </>
          ),
        })}
      />
      <Modal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        className="iv-dialog-wide"
        title={known ? 'Edit customer' : 'New customer'}
        description="Invoices copy these details when you pick the customer. Issued invoices keep their own copy."
      >
        {editing && (
          <CustomerForm
            key={editing.id}
            initial={editing}
            onDone={(saved) => {
              setEditing(null);
              if (saved) toast(known ? 'Customer updated' : 'Customer added');
            }}
          />
        )}
      </Modal>
      <ConfirmRemove
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name || 'this customer'}?`}
        description="Existing invoices keep their customer details."
        onConfirm={async () => {
          if (!removing) return true;
          try {
            const result = await mutate({
              action: 'forget',
              kind: 'customer',
              id: removing.id,
            });
            if (!result.ok) throw new Error('Delete failed');
            toast('Customer deleted');
            return true;
          } catch {
            toast('The customer could not be deleted.', 'error');
            return false;
          }
        }}
      />
    </>
  );
}

function CustomerForm({
  initial,
  onDone,
}: {
  initial: Customer;
  onDone: (saved: boolean) => void;
}) {
  const { mutate } = useWorkspace();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { ref, shake } = useShake();
  const form = useForm({
    defaultValues: { customer: initial },
    onSubmit: async ({ value }) => {
      setError('');
      if (!value.customer.name.trim()) {
        setError('Enter the customer’s legal name.');
        shake();
        return;
      }
      setPending(true);
      try {
        const result = await mutate({
          action: 'customer',
          customer: Schema.decodeUnknownSync(CustomerSchema)(value.customer),
        });
        if (!result.ok) throw new Error('Save failed');
        onDone(true);
      } catch {
        setError('The customer could not be saved.');
        shake();
      } finally {
        setPending(false);
      }
    },
  });
  const customer = useSelector(form.store, (state) => state.values.customer);
  return (
    <FormShell
      formRef={ref}
      onSubmit={() => {
        form.handleSubmit();
      }}
      pending={pending}
      error={error}
      onCancel={() => onDone(false)}
      submitLabel="Save customer"
    >
      <PartyFields
        value={customer}
        onChange={(party) =>
          form.setFieldValue('customer', { ...customer, ...party })
        }
      />
      <div className="iv-grid">
        <Select
          label="Type"
          value={customer.type}
          onChange={(type) => form.setFieldValue('customer.type', type)}
          options={customerTypes}
        />
        <TerritorySelect
          value={customer.territory}
          address={customer.address}
          onChange={(territory) =>
            form.setFieldValue('customer.territory', territory)
          }
        />
        <Select
          label="Invoice language"
          value={customer.language}
          onChange={(language) =>
            form.setFieldValue('customer.language', language)
          }
          options={languages}
        />
      </div>
    </FormShell>
  );
}

export function ItemDirectory() {
  const { workspace, items, mutate, isError } = useWorkspace();
  const live = useLiveQuery((query) => query.from({ item: items }));
  const rows = live.isReady ? live.data : (workspace?.items ?? []);
  const toast = useToast();
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [removing, setRemoving] = useState<CatalogItem | null>(null);
  const known = editing && rows.some((item) => item.id === editing.id);
  return (
    <>
      <DirectoryPage
        title="Catalog"
        noun="item"
        list="items"
        columns={['Name', 'Description', 'Price']}
        figureLast
        rows={rows}
        search={(item) => `${item.name} ${item.description}`}
        empty={{
          title: 'Your catalog is empty',
          body: 'Save the work you bill often. Add it to any draft in one step.',
        }}
        onAdd={() => setEditing({ ...newLine(), name: '' })}
        onOpen={setEditing}
        onRemove={setRemoving}
        error={isError ? 'Items could not load.' : ''}
        renderRow={(item) => ({
          name: item.name || 'Unnamed item',
          cells: (
            <>
              <div>
                <strong>{item.name || 'Unnamed item'}</strong>
                <small>
                  {lineKinds.find(([key]) => key === item.kind)?.[1]}
                  {item.tax.treatment === 'taxable'
                    ? ` · IGIC ${item.tax.rate}%`
                    : ''}
                </small>
              </div>
              <span className="iv-muted iv-hide-narrow">
                {item.description || '—'}
              </span>
              <strong className="iv-end iv-num iv-hide-narrow">
                {formatMoney(item.unitPrice, 'en')}
                <small>per {item.unit}</small>
              </strong>
            </>
          ),
        })}
      />
      <Modal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        className="iv-dialog-wide"
        title={known ? 'Edit item' : 'New item'}
        description="A reusable line with its price and tax treatment."
      >
        {editing && (
          <ItemForm
            key={editing.id}
            initial={editing}
            onDone={(saved) => {
              setEditing(null);
              if (saved) toast(known ? 'Item updated' : 'Item added');
            }}
          />
        )}
      </Modal>
      <ConfirmRemove
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name || 'this item'}?`}
        description="Invoices that already use it stay unchanged."
        onConfirm={async () => {
          if (!removing) return true;
          try {
            const result = await mutate({
              action: 'forget',
              kind: 'item',
              id: removing.id,
            });
            if (!result.ok) throw new Error('Delete failed');
            toast('Item deleted');
            return true;
          } catch {
            toast('The item could not be deleted.', 'error');
            return false;
          }
        }}
      />
    </>
  );
}

function ItemForm({
  initial,
  onDone,
}: {
  initial: CatalogItem;
  onDone: (saved: boolean) => void;
}) {
  const { mutate } = useWorkspace();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { ref, shake } = useShake();
  const form = useForm({
    defaultValues: { item: initial },
    onSubmit: async ({ value }) => {
      setError('');
      if (!value.item.name.trim()) {
        setError('Give the item a name.');
        shake();
        return;
      }
      setPending(true);
      try {
        const result = await mutate({
          action: 'item',
          item: Schema.decodeUnknownSync(CatalogItemSchema)(value.item),
        });
        if (!result.ok) throw new Error('Save failed');
        onDone(true);
      } catch {
        setError('Check the numbers, then try again.');
        shake();
      } finally {
        setPending(false);
      }
    },
  });
  const item = useSelector(form.store, (state) => state.values.item);
  return (
    <FormShell
      formRef={ref}
      onSubmit={() => {
        form.handleSubmit();
      }}
      pending={pending}
      error={error}
      onCancel={() => onDone(false)}
      submitLabel="Save item"
    >
      <Field
        label="Name"
        value={item.name}
        placeholder="Only you see this"
        onChange={(name) => form.setFieldValue('item.name', name)}
      />
      <Field
        label="Description"
        value={item.description}
        placeholder="Printed on the invoice"
        multiline
        onChange={(description) =>
          form.setFieldValue('item.description', description)
        }
      />
      <div className="iv-grid">
        <AmountField
          label="Unit price"
          unit={currencySymbol('EUR')}
          step={10}
          value={item.unitPrice}
          onChange={(unitPrice) =>
            form.setFieldValue('item.unitPrice', unitPrice)
          }
        />
        <AmountField
          label="Default quantity"
          {...(item.unit && item.unit !== 'unit' ? { unit: item.unit } : {})}
          value={item.quantity}
          onChange={(quantity) => form.setFieldValue('item.quantity', quantity)}
        />
        <Field
          label="Unit"
          value={item.unit === 'unit' ? '' : item.unit}
          placeholder="hour, day, month"
          onChange={(unit) =>
            form.setFieldValue('item.unit', unit.trim() ? unit : 'unit')
          }
        />
        <Select
          label="Kind"
          value={item.kind}
          onChange={(kind) => form.setFieldValue('item.kind', kind)}
          options={lineKinds}
        />
        <Select
          label="Tax treatment"
          value={item.tax.treatment}
          onChange={(treatment) =>
            form.setFieldValue('item.tax', {
              ...item.tax,
              treatment,
              rate: treatment === 'taxable' ? '7' : '0',
            })
          }
          options={treatments}
        />
        <Select
          label="IGIC"
          value={item.tax.treatment === 'taxable' ? item.tax.rate : '0'}
          disabled={item.tax.treatment !== 'taxable'}
          onChange={(rate) =>
            form.setFieldValue('item.tax', { ...item.tax, rate })
          }
          options={igicRates}
          context="Canary Islands"
        />
        <Field
          className="iv-span"
          label="Legal basis or exemption reason"
          value={item.tax.reason}
          onChange={(reason) =>
            form.setFieldValue('item.tax', { ...item.tax, reason })
          }
        />
      </div>
    </FormShell>
  );
}
