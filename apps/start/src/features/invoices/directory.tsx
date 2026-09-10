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
import { useForm, useStore } from '@tanstack/react-form';
import { Schema } from 'effect';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { PartyFields } from './party-fields';
import { Field, Modal, Morph, Select } from './ui';
import { useWorkspace } from './workspace';

function FormShell({
  onSubmit,
  pending,
  error,
  onCancel,
  submitLabel,
  pendingLabel,
  children,
}: {
  onSubmit: () => void;
  pending: boolean;
  error: string;
  onCancel: () => void;
  submitLabel: string;
  pendingLabel: string;
  children: ReactNode;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <form onSubmit={submit}>
      {children}
      {error && (
        <p className="iv-error" role="alert">
          {error}
        </p>
      )}
      <div className="iv-dialog-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="iv-primary" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function CustomerDirectory() {
  const { customers, mutate, isError } = useWorkspace();
  const { data: rows = [] } = useLiveQuery((query) =>
    query.from({ customer: customers }),
  );
  const [editing, setEditing] = useState<Customer | null>(null);
  const [removing, setRemoving] = useState<Customer | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  return (
    <>
      <header className="iv-topbar">
        <div className="iv-breadcrumb">
          Workspace<span>/</span>Customers
        </div>
      </header>
      <div className="iv-directory">
        <div className="iv-directory-heading">
          <div>
            <h1>Customers</h1>
            <p>The people and businesses you work with.</p>
          </div>
          <button
            className="iv-primary"
            onClick={() =>
              setEditing({
                ...blankParty,
                id: RecordId.make(crypto.randomUUID()),
                type: 'business',
                territory: 'canary-islands',
                language: 'en',
              })
            }
          >
            <Plus size={16} />
            Add customer
          </button>
        </div>
        {(error || isError) && (
          <div className="iv-error" role="alert">
            <Morph>{error || 'Customers could not load.'}</Morph>
          </div>
        )}
        {rows.length ? (
          <div className="iv-directory-rows">
            {rows.map((customer) => (
              <div className="iv-directory-row" key={customer.id}>
                <div>
                  <strong>{customer.name || 'Unnamed customer'}</strong>
                  <span>
                    {[customer.taxId, customer.city, customer.email]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <button
                  onClick={() => setEditing(customer)}
                  aria-label={`Edit ${customer.name}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setRemoving(customer)}
                  aria-label={`Delete ${customer.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="iv-empty">
            <h2>No customers yet</h2>
            <p>Save customer details to use them in your next invoice.</p>
          </div>
        )}
      </div>
      <Modal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={
          editing && rows.some((customer) => customer.id === editing.id)
            ? 'Edit customer'
            : 'Add customer'
        }
        description="Saved customer details can be copied into a draft. Issued invoice details stay fixed."
      >
        {editing && (
          <CustomerForm
            key={editing.id}
            initial={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!removing}
        onOpenChange={(open) => {
          if (!pending && !open) setRemoving(null);
        }}
        title="Delete customer?"
        description="Existing invoices keep their customer details."
      >
        <div className="iv-dialog-actions">
          <button onClick={() => setRemoving(null)}>Cancel</button>
          <button
            className="iv-danger"
            disabled={pending}
            onClick={async () => {
              if (!removing) return;
              setPending(true);
              try {
                const result = await mutate({
                  action: 'forget',
                  kind: 'customer',
                  id: removing.id,
                });
                if (!result.ok) throw new Error('Delete failed');
                setRemoving(null);
              } catch {
                setError('The customer could not be deleted.');
              } finally {
                setPending(false);
              }
            }}
          >
            <Morph>{pending ? 'Deleting…' : 'Delete customer'}</Morph>
          </button>
        </div>
      </Modal>
    </>
  );
}

function CustomerForm({
  initial,
  onDone,
}: {
  initial: Customer;
  onDone: () => void;
}) {
  const { mutate } = useWorkspace();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const form = useForm({
    defaultValues: { customer: initial },
    onSubmit: async ({ value }) => {
      setError('');
      if (!value.customer.name.trim()) {
        setError('Enter the customer’s legal name.');
        return;
      }
      setPending(true);
      try {
        const result = await mutate({
          action: 'customer',
          customer: Schema.decodeUnknownSync(CustomerSchema)(value.customer),
        });
        if (!result.ok) throw new Error('Save failed');
        onDone();
      } catch {
        setError('The customer could not be saved.');
      } finally {
        setPending(false);
      }
    },
  });
  const customer = useStore(form.store, (state) => state.values.customer);
  return (
    <FormShell
      onSubmit={() => {
        form.handleSubmit();
      }}
      pending={pending}
      error={error}
      onCancel={onDone}
      submitLabel="Save customer"
      pendingLabel="Saving…"
    >
      <PartyFields
        value={customer}
        onChange={(party) =>
          form.setFieldValue('customer', { ...customer, ...party })
        }
      />
      <div className="iv-form-grid">
        <Select
          label="Type"
          value={customer.type}
          onChange={(type) => form.setFieldValue('customer.type', type)}
          options={[
            ['business', 'Business'],
            ['consumer', 'Consumer'],
          ]}
        />
        <Select
          label="Territory"
          value={customer.territory}
          onChange={(territory) =>
            form.setFieldValue('customer.territory', territory)
          }
          options={[
            ['canary-islands', 'Canary Islands'],
            ['mainland-spain', 'Mainland Spain / Balearics'],
            ['eu', 'European Union'],
            ['other', 'Other'],
          ]}
        />
        <Select
          label="Preferred language"
          value={customer.language}
          onChange={(language) =>
            form.setFieldValue('customer.language', language)
          }
          options={[
            ['en', 'English'],
            ['es', 'Español'],
          ]}
        />
      </div>
    </FormShell>
  );
}

export function ItemDirectory() {
  const { items, mutate, isError } = useWorkspace();
  const { data: rows = [] } = useLiveQuery((query) =>
    query.from({ item: items }),
  );
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [removing, setRemoving] = useState<CatalogItem | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <header className="iv-topbar">
        <div className="iv-breadcrumb">
          Workspace<span>/</span>Items
        </div>
      </header>
      <div className="iv-directory">
        <div className="iv-directory-heading">
          <div>
            <h1>Item catalog</h1>
            <p>Keep your services, products, and rates close.</p>
          </div>
          <button
            className="iv-primary"
            onClick={() => setEditing({ ...newLine(), name: '' })}
          >
            <Plus size={16} />
            Add item
          </button>
        </div>
        {(error || isError) && (
          <div className="iv-error" role="alert">
            <Morph>{error || 'Items could not load.'}</Morph>
          </div>
        )}
        {rows.length ? (
          <div className="iv-directory-rows">
            {rows.map((item) => (
              <div className="iv-directory-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                </div>
                <span>
                  {formatMoney(item.unitPrice, 'en')} / {item.unit}
                </span>
                <button
                  onClick={() => setEditing(item)}
                  aria-label={`Edit ${item.name}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setRemoving(item)}
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="iv-empty">
            <h2>Build your catalog</h2>
            <p>Add the work you invoice often. Insert it into any draft.</p>
          </div>
        )}
      </div>
      <Modal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title="Catalog item"
        description="A reusable item with its price and tax treatment."
      >
        {editing && (
          <ItemForm
            key={editing.id}
            initial={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!removing}
        onOpenChange={(open) => {
          if (!pending && !open) setRemoving(null);
        }}
        title="Delete catalog item?"
        description="Existing invoice items stay unchanged."
      >
        <div className="iv-dialog-actions">
          <button onClick={() => setRemoving(null)}>Cancel</button>
          <button
            className="iv-danger"
            disabled={pending}
            onClick={async () => {
              if (!removing) return;
              setPending(true);
              try {
                const result = await mutate({
                  action: 'forget',
                  kind: 'item',
                  id: removing.id,
                });
                if (!result.ok) throw new Error('Delete failed');
                setRemoving(null);
              } catch {
                setError('The item could not be deleted.');
              } finally {
                setPending(false);
              }
            }}
          >
            <Morph>{pending ? 'Deleting…' : 'Delete item'}</Morph>
          </button>
        </div>
      </Modal>
    </>
  );
}

function ItemForm({
  initial,
  onDone,
}: {
  initial: CatalogItem;
  onDone: () => void;
}) {
  const { mutate } = useWorkspace();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const form = useForm({
    defaultValues: { item: initial },
    onSubmit: async ({ value }) => {
      setError('');
      if (!value.item.name.trim()) {
        setError('Enter a catalog name.');
        return;
      }
      setPending(true);
      try {
        const result = await mutate({
          action: 'item',
          item: Schema.decodeUnknownSync(CatalogItemSchema)(value.item),
        });
        if (!result.ok) throw new Error('Save failed');
        onDone();
      } catch {
        setError('Check the item values, then try again.');
      } finally {
        setPending(false);
      }
    },
  });
  const item = useStore(form.store, (state) => state.values.item);
  return (
    <FormShell
      onSubmit={() => {
        form.handleSubmit();
      }}
      pending={pending}
      error={error}
      onCancel={onDone}
      submitLabel="Save item"
      pendingLabel="Saving…"
    >
      <Field
        label="Catalog name"
        value={item.name}
        onChange={(name) => form.setFieldValue('item.name', name)}
      />
      <Field
        label="Description"
        value={item.description}
        onChange={(description) =>
          form.setFieldValue('item.description', description)
        }
        placeholder="Describe the work or item"
        multiline
      />
      <div className="iv-line-amounts">
        <Field
          label="Quantity"
          value={item.quantity}
          onChange={(quantity) => form.setFieldValue('item.quantity', quantity)}
        />
        <Field
          label="Unit price"
          value={item.unitPrice}
          onChange={(unitPrice) =>
            form.setFieldValue('item.unitPrice', unitPrice)
          }
        />
        <Field
          label="Unit"
          value={item.unit}
          onChange={(unit) => form.setFieldValue('item.unit', unit)}
        />
      </div>
      <div className="iv-form-grid">
        <Select
          label="Item type"
          value={item.kind}
          onChange={(kind) => form.setFieldValue('item.kind', kind)}
          options={[
            ['service', 'Service'],
            ['product', 'Product'],
            ['time', 'Time'],
            ['expense', 'Expense'],
            ['shipping', 'Shipping'],
            ['fee', 'Fee'],
            ['disbursement', 'Disbursement'],
            ['note', 'Note'],
          ]}
        />
        <Select
          label="IGIC"
          value={item.tax.rate}
          onChange={(rate) =>
            form.setFieldValue('item.tax', { ...item.tax, rate })
          }
          options={['0', '3', '5', '7', '9.5', '15', '20'].map(
            (rate) => [rate, `${rate}%`] as const,
          )}
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
          options={[
            ['taxable', 'Taxable'],
            ['exempt', 'Exempt'],
            ['outside-scope', 'Outside scope'],
            ['reverse-charge', 'Reverse charge'],
          ]}
        />
        <Field
          label="Legal basis / exemption reason"
          value={item.tax.reason}
          onChange={(reason) =>
            form.setFieldValue('item.tax', { ...item.tax, reason })
          }
        />
        <Select
          label="Discount type"
          value={item.discount.kind}
          onChange={(kind) =>
            form.setFieldValue('item.discount', { ...item.discount, kind })
          }
          options={[
            ['percent', 'Percentage'],
            ['amount', 'Fixed amount'],
          ]}
        />
        <Field
          label="Discount"
          value={item.discount.value}
          onChange={(value) =>
            form.setFieldValue('item.discount', { ...item.discount, value })
          }
        />
      </div>
    </FormShell>
  );
}
