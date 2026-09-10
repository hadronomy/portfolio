import { balance, calculate, formatMoney } from '@portfolio/invoices/calculate';
import type {
  Invoice,
  InvoiceData,
  Line,
  Payment,
} from '@portfolio/invoices/model';
import { newLine, RecordId } from '@portfolio/invoices/model';
import { issueErrors } from '@portfolio/invoices/validate';
import { useForm, useStore } from '@tanstack/react-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Plus,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LineEditor } from './line-editor';
import { PartyFields } from './party-fields';
import { Field, Modal, Morph, Select, Tabs } from './ui';
import { useDraft } from './use-draft';
import { useWorkspace } from './workspace';

const PdfViewer = lazy(() => import('./pdf-viewer'));

function useInvoiceForm(data: InvoiceData) {
  return useForm({ defaultValues: data });
}
type InvoiceForm = ReturnType<typeof useInvoiceForm>;

type PaymentMethod = 'transfer' | 'cash' | 'card' | 'other';
type PaymentDraft = {
  amount: string;
  date: string;
  reference: string;
  method: PaymentMethod;
};

type DraftHandle = {
  flush: () => Promise<Invoice | null>;
  acceptServer: () => InvoiceData | null;
  clearRecovery: () => void;
};

type DraftMeta = {
  status: string;
  previewStatus: string;
  recovery: InvoiceData | null;
  conflict: Invoice | null;
  hasBytes: boolean;
};

function useMutationState() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(
    async (
      task: () => Promise<string | null>,
      failure: string,
    ): Promise<boolean> => {
      setPending(true);
      setError('');
      try {
        const problem = await task();
        if (problem) {
          setError(problem);
          return false;
        }
        return true;
      } catch {
        setError(failure);
        return false;
      } finally {
        setPending(false);
      }
    },
    [],
  );
  return { pending, error, setError, run };
}

function useTotals(form: InvoiceForm) {
  const lines = useStore(form.store, (state) => state.values.lines);
  const discount = useStore(form.store, (state) => state.values.discount);
  const withholdingRate = useStore(
    form.store,
    (state) => state.values.withholdingRate,
  );
  return useMemo(() => {
    try {
      return calculate({ lines, discount, withholdingRate } as InvoiceData);
    } catch {
      return null;
    }
  }, [lines, discount, withholdingRate]);
}

function useNarrow(query = '(max-width: 900px)') {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setNarrow(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return narrow;
}

export function InvoiceEditor({ id }: { id: string }) {
  const { workspace, isError } = useWorkspace();
  const invoice = workspace?.invoices.find((invoice) => invoice.id === id);
  if (!workspace)
    return (
      <div className="iv-preview-message">
        {isError ? 'The invoice could not load.' : 'Loading invoice…'}
      </div>
    );
  if (!invoice)
    return (
      <div className="iv-empty">
        <h1>Invoice not found</h1>
        <Link to="/invoices">Return to invoices</Link>
      </div>
    );
  return <Editor key={`${id}:${invoice.status}`} invoice={invoice} />;
}

type Section = 'details' | 'customer' | 'items' | 'terms';
const SECTIONS: ReadonlyArray<readonly [Section, string]> = [
  ['details', 'Details'],
  ['customer', 'Customer'],
  ['items', 'Items'],
  ['terms', 'Terms'],
];

function Editor({ invoice }: { invoice: Invoice }) {
  const { mutate } = useWorkspace();
  const navigate = useNavigate();
  const form = useInvoiceForm(invoice.data);
  const { pending, error, setError, run } = useMutationState();
  const [section, setSection] = useState<Section>('details');
  const [dialog, setDialog] = useState<'issue' | 'delete' | 'payment' | null>(
    null,
  );
  const [view, setView] = useState<'preview' | 'edit'>('edit');
  const [meta, setMeta] = useState<DraftMeta>({
    status: 'Saved',
    previewStatus: 'Preparing PDF…',
    recovery: null,
    conflict: null,
    hasBytes: false,
  });
  const [snapshot, setSnapshot] = useState<InvoiceData | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const draftApi = useRef<DraftHandle | null>(null);
  const narrow = useNarrow();
  const issued = invoice.status === 'issued';
  const onMeta = useCallback((next: DraftMeta) => setMeta(next), []);
  const flush = useCallback(
    () => draftApi.current?.flush() ?? Promise.resolve(null),
    [],
  );

  const issue = useCallback(async () => {
    await run(async () => {
      const saved = await flush();
      if (!saved) return 'Save the draft before you issue it.';
      const result = await mutate({
        action: 'issue',
        id: saved.id,
        revision: saved.revision,
        key: `issue:${saved.id}:${saved.revision}`,
      });
      if (!result.ok)
        return (
          result.issues.map((issue) => issue.message).join(' ') ||
          'The invoice could not be issued. Reload the draft and try again.'
        );
      setDialog(null);
      return null;
    }, 'The issue request failed. You can safely retry it.');
  }, [run, flush, mutate]);

  const remove = useCallback(async () => {
    await run(async () => {
      const result = await mutate({ action: 'remove', id: invoice.id });
      if (!result.ok) return 'The draft could not be deleted. Try again.';
      try {
        localStorage.removeItem(`invoice-draft:${invoice.id}`);
      } catch {
        return 'The draft was deleted, but device storage could not be cleared.';
      }
      await navigate({ to: '/invoices' });
      return null;
    }, 'The draft could not be deleted. Try again.');
  }, [run, mutate, invoice.id, navigate]);

  const rectify = useCallback(async () => {
    await run(async () => {
      const result = await mutate({ action: 'rectify', id: invoice.id });
      if (!result.ok) return 'The rectifying draft could not be created.';
      const next = result.workspace.invoices.find(
        (item) =>
          item.data.correction?.invoiceId === invoice.id &&
          item.status === 'draft',
      );
      if (next)
        await navigate({
          to: '/invoices/$invoiceId',
          params: { invoiceId: next.id },
        });
      return null;
    }, 'The rectifying draft could not be created.');
  }, [run, mutate, invoice.id, navigate]);

  const recordPayment = useCallback(
    async (payment: PaymentDraft) => {
      await run(async () => {
        const result = await mutate({
          action: 'payment',
          payment: {
            id: RecordId.make(crypto.randomUUID()),
            invoiceId: invoice.id,
            amount: payment.amount,
            date: payment.date,
            method: payment.method,
            reference: payment.reference,
            createdAt: new Date().toISOString(),
            reversedAt: null,
          },
        });
        if (!result.ok)
          return (
            result.issues.map((issue) => issue.message).join(' ') ||
            'The payment could not be saved.'
          );
        setDialog(null);
        return null;
      }, 'The payment could not be saved. Check the values and try again.');
    },
    [run, mutate, invoice.id],
  );

  const reversePayment = useCallback(
    async (paymentId: Payment['id']) => {
      await run(async () => {
        const result = await mutate({
          action: 'reverse-payment',
          id: paymentId,
        });
        if (!result.ok) return 'The payment could not be reversed.';
        return null;
      }, 'The payment could not be reversed.');
    },
    [run, mutate],
  );

  function openIssue() {
    setSnapshot(form.state.values);
    setDialog('issue');
  }

  function openPayment(amount: string) {
    setPaymentAmount(amount);
    setDialog('payment');
  }

  return (
    <div className="iv-editor">
      <header className="iv-topbar">
        <div className="iv-breadcrumb">
          <Link to="/invoices" aria-label="Back to invoices">
            <ArrowLeft size={17} />
          </Link>
          <Link to="/invoices">Invoices</Link>
          <span>/</span>
          <form.Field name="title">
            {(title) => (
              <>{invoice.number ?? (title.state.value || 'Untitled draft')}</>
            )}
          </form.Field>
        </div>
        <div className="iv-header-actions">
          <button
            className="iv-save-status"
            onClick={() => {
              flush();
            }}
            disabled={issued}
          >
            <Morph>{issued ? 'Issued · Record locked' : meta.status}</Morph>
          </button>
          <DownloadLink
            form={form}
            invoiceId={invoice.id}
            flush={flush}
            onError={setError}
          />
          {!issued && (
            <button
              className="iv-primary"
              onClick={openIssue}
              disabled={pending}
            >
              Review & issue
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      </header>
      {narrow && (
        <Tabs
          label="Editor view"
          value={view}
          onChange={setView}
          options={[
            ['preview', 'Preview'],
            ['edit', 'Details'],
          ]}
        />
      )}
      <div className="iv-editor-body">
        {(!narrow || view === 'preview') && (
          <DraftScope
            form={form}
            invoice={invoice}
            apiRef={draftApi}
            onMeta={onMeta}
          />
        )}
        {(!narrow || view === 'edit') && (
          <Inspector
            form={form}
            invoice={invoice}
            issued={issued}
            section={section}
            onSection={setSection}
            meta={meta}
            draftApi={draftApi}
            error={error}
            pending={pending}
            rectify={rectify}
            reversePayment={reversePayment}
            onDelete={() => setDialog('delete')}
            onPayment={openPayment}
          />
        )}
      </div>
      <Modal
        open={dialog === 'issue'}
        onOpenChange={(open) => {
          if (!pending && !open) setDialog(null);
        }}
        title="Review and issue"
        description="Issuing assigns a permanent number and locks the document. Use a rectifying invoice for later corrections."
      >
        {snapshot && (
          <IssueDialogBody
            snapshot={snapshot}
            error={error}
            pending={pending}
            onClose={() => setDialog(null)}
            onIssue={() => {
              issue();
            }}
          />
        )}
      </Modal>
      <Modal
        open={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!pending && !open) setDialog(null);
        }}
        title="Delete this draft?"
        description="The draft and unsaved changes on this device will be deleted."
      >
        <div className="iv-dialog-actions">
          <button onClick={() => setDialog(null)}>Keep draft</button>
          <button
            className="iv-danger"
            onClick={() => {
              remove();
            }}
            disabled={pending}
          >
            {pending ? 'Deleting…' : 'Delete draft'}
          </button>
        </div>
      </Modal>
      {dialog === 'payment' && (
        <PaymentDialog
          initialAmount={paymentAmount}
          pending={pending}
          error={error}
          onClose={() => setDialog(null)}
          onRecord={(payment) => {
            recordPayment(payment);
          }}
        />
      )}
    </div>
  );
}

function DownloadLink({
  form,
  invoiceId,
  flush,
  onError,
}: {
  form: InvoiceForm;
  invoiceId: string;
  flush: () => Promise<Invoice | null>;
  onError: (message: string) => void;
}) {
  const language = useStore(form.store, (state) => state.values.language);
  // Plain anchor, not a router Link: this route serves PDF bytes with no
  // component, so client-side navigation would render nothing and download
  // nothing. A document request lets the browser handle the file.
  return (
    <a
      href={`/invoices/pdf/${invoiceId}?lang=${language}`}
      download
      aria-label="Download PDF"
      onClick={async (event) => {
        const saved = await flush();
        if (!saved) {
          event.preventDefault();
          onError('Save the draft before downloading the PDF.');
        }
      }}
    >
      <Download size={17} />
    </a>
  );
}

function DraftScope({
  form,
  invoice,
  apiRef,
  onMeta,
}: {
  form: InvoiceForm;
  invoice: Invoice;
  apiRef: { current: DraftHandle | null };
  onMeta: (meta: DraftMeta) => void;
}) {
  return (
    <form.Subscribe selector={(state) => state.values}>
      {(values) => (
        <DraftInner
          form={form}
          invoice={invoice}
          values={values}
          apiRef={apiRef}
          onMeta={onMeta}
        />
      )}
    </form.Subscribe>
  );
}

const DraftInner = memo(function DraftInner({
  form,
  invoice,
  values,
  apiRef,
  onMeta,
}: {
  form: InvoiceForm;
  invoice: Invoice;
  values: InvoiceData;
  apiRef: { current: DraftHandle | null };
  onMeta: (meta: DraftMeta) => void;
}) {
  const draft = useDraft(invoice, values);
  const [client] = useState(() => typeof window !== 'undefined');
  const { flush, acceptServer, clearRecovery } = draft;
  useEffect(() => {
    apiRef.current = { flush, acceptServer, clearRecovery };
  }, [apiRef, flush, acceptServer, clearRecovery]);
  const { status, previewStatus, recovery, conflict, bytes } = draft;
  useEffect(() => {
    onMeta({
      status,
      previewStatus,
      recovery,
      conflict,
      hasBytes: bytes.length > 0,
    });
  }, [status, previewStatus, recovery, conflict, bytes, onMeta]);
  return (
    <div className="iv-canvas">
      <CanvasHeading form={form} />
      <PreviewBody
        client={client}
        bytes={bytes}
        previewStatus={previewStatus}
      />
      <div className="iv-canvas-footer">
        <span>
          <Morph>{previewStatus}</Morph>
        </span>
        <span>A4 · Selectable PDF</span>
      </div>
    </div>
  );
});

// Heading chrome never reads draft values, so keystrokes that re-render the
// subscribed parent skip it through memo.
const CanvasHeading = memo(function CanvasHeading({
  form,
}: {
  form: InvoiceForm;
}) {
  return (
    <div className="iv-canvas-heading">
      <span>Document preview</span>
      <div className="iv-language">
        <form.Field name="language">
          {(language) => (
            <>
              <button
                aria-pressed={language.state.value === 'en'}
                onClick={() => language.handleChange('en')}
              >
                EN
              </button>
              <span>/</span>
              <button
                aria-pressed={language.state.value === 'es'}
                onClick={() => language.handleChange('es')}
              >
                ES
              </button>
            </>
          )}
        </form.Field>
      </div>
    </div>
  );
});

// Preview body only re-renders when the debounced bytes or status change.
const PreviewBody = memo(function PreviewBody({
  client,
  bytes,
  previewStatus,
}: {
  client: boolean;
  bytes: string;
  previewStatus: string;
}) {
  return (
    <div className="iv-viewer-frame">
      {client && bytes ? (
        <Suspense
          fallback={
            <div className="iv-preview-message">Loading PDF viewer…</div>
          }
        >
          <PdfViewer bytes={bytes} />
        </Suspense>
      ) : (
        <div className="iv-preview-message">
          <Morph>{previewStatus}</Morph>
        </div>
      )}
    </div>
  );
});

type InspectorProps = {
  form: InvoiceForm;
  invoice: Invoice;
  issued: boolean;
  section: Section;
  onSection: (section: Section) => void;
  meta: DraftMeta;
  draftApi: { current: DraftHandle | null };
  error: string;
  pending: boolean;
  rectify: () => void;
  reversePayment: (paymentId: Payment['id']) => void;
  onDelete: () => void;
  onPayment: (amount: string) => void;
};

const Inspector = memo(function Inspector({
  form,
  invoice,
  issued,
  section,
  onSection,
  meta,
  draftApi,
  error,
  pending,
  rectify,
  reversePayment,
  onDelete,
  onPayment,
}: InspectorProps) {
  const totals = useTotals(form);
  return (
    <aside className="iv-inspector" aria-label="Invoice details">
      <div className="iv-inspector-title">
        <h2>{issued ? 'Invoice record' : 'Make it yours'}</h2>
        <span>{issued ? (invoice.number ?? '') : 'Draft'}</span>
      </div>
      <Tabs
        label="Invoice sections"
        value={section}
        onChange={onSection}
        options={SECTIONS}
        className="iv-editor-tabs"
      />
      <div className="iv-inspector-scroll">
        {error && (
          <div role="alert" className="iv-error">
            <Morph>{error}</Morph>
          </div>
        )}
        {meta.recovery && (
          <div className="iv-notice">
            <p>Unsaved changes are available on this device.</p>
            <button
              onClick={() => {
                if (meta.recovery) form.reset(meta.recovery);
                draftApi.current?.clearRecovery();
              }}
            >
              Restore changes
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem(`invoice-draft:${invoice.id}`);
                } catch {
                  /* Device storage is unavailable; the saved version stays. */
                }
                draftApi.current?.clearRecovery();
              }}
            >
              Use saved version
            </button>
          </div>
        )}
        {meta.conflict && (
          <div className="iv-notice" role="alert">
            <p>
              Another tab saved this draft. Your changes remain on this device.
            </p>
            <button
              onClick={() => {
                const server = draftApi.current?.acceptServer();
                if (server) form.reset(server);
              }}
            >
              Load the saved version
            </button>
          </div>
        )}
        {/* Panel transitions animate section switches only: first paint and
            resting states match the static layout exactly. */}
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {section === 'details' && (
              <DetailsSection
                form={form}
                invoice={invoice}
                issued={issued}
                totals={totals}
                pending={pending}
                rectify={rectify}
                reversePayment={reversePayment}
                onPayment={onPayment}
              />
            )}
            {section === 'customer' && (
              <CustomerSection form={form} issued={issued} />
            )}
            {section === 'items' && (
              <ItemsSection form={form} issued={issued} />
            )}
            {section === 'terms' && (
              <TermsSection form={form} issued={issued} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="iv-inspector-bottom">
        <TotalsLabel form={form} totals={totals} />
        {!issued && (
          <button className="iv-delete" onClick={onDelete}>
            <Trash2 size={14} />
            Delete draft
          </button>
        )}
      </div>
    </aside>
  );
});

const TotalsLabel = memo(function TotalsLabel({
  form,
  totals,
}: {
  form: InvoiceForm;
  totals: ReturnType<typeof calculate> | null;
}) {
  const currency = useStore(form.store, (state) => state.values.currency);
  const language = useStore(form.store, (state) => state.values.language);
  return (
    <div>
      <span>Total</span>
      <strong>
        <Morph>
          {totals ? formatMoney(totals.total, language, currency) : '—'}
        </Morph>
      </strong>
    </div>
  );
});

const DetailsSection = memo(function DetailsSection({
  form,
  invoice,
  issued,
  totals,
  pending,
  rectify,
  reversePayment,
  onPayment,
}: {
  form: InvoiceForm;
  invoice: Invoice;
  issued: boolean;
  totals: ReturnType<typeof calculate> | null;
  pending: boolean;
  rectify: () => void;
  reversePayment: (paymentId: Payment['id']) => void;
  onPayment: (amount: string) => void;
}) {
  const { workspace } = useWorkspace();
  const payments = useMemo(
    () =>
      (workspace?.payments ?? []).filter(
        (payment) => payment.invoiceId === invoice.id,
      ),
    [workspace, invoice.id],
  );
  const currency = useStore(form.store, (state) => state.values.currency);
  const language = useStore(form.store, (state) => state.values.language);
  const correction = useStore(form.store, (state) => state.values.correction);
  const remaining = totals ? balance(totals.total, payments) : '0';
  return (
    <>
      <form.Field name="title">
        {(title) => (
          <Field
            label="Document title (optional)"
            value={title.state.value}
            disabled={issued}
            onChange={(next) => title.handleChange(next)}
            placeholder="A name for this project"
          />
        )}
      </form.Field>
      <div className="iv-form-grid">
        <form.Field name="kind">
          {(kind) => (
            <Select
              label="Document type"
              value={kind.state.value}
              disabled={issued || kind.state.value === 'rectification'}
              onChange={(next) => kind.handleChange(next)}
              options={
                kind.state.value === 'rectification'
                  ? [['rectification', 'Rectifying invoice']]
                  : [
                      ['invoice', 'Invoice'],
                      ['proforma', 'Proforma'],
                    ]
              }
            />
          )}
        </form.Field>
        <form.Field name="series">
          {(series) => (
            <Field
              label="Numbering series"
              value={series.state.value}
              disabled={issued}
              onChange={(next) => series.handleChange(next)}
            />
          )}
        </form.Field>
        <form.Field name="issueDate">
          {(date) => (
            <Field
              label="Issue date"
              type="date"
              value={date.state.value}
              disabled={issued}
              onChange={(next) => date.handleChange(next)}
            />
          )}
        </form.Field>
        <form.Field name="supplyDate">
          {(date) => (
            <Field
              label="Supply date"
              type="date"
              value={date.state.value}
              disabled={issued}
              onChange={(next) => date.handleChange(next)}
            />
          )}
        </form.Field>
        <form.Field name="dueDate">
          {(date) => (
            <Field
              label="Due date"
              type="date"
              value={date.state.value}
              disabled={issued}
              onChange={(next) => date.handleChange(next)}
            />
          )}
        </form.Field>
        <form.Field name="currency">
          {(money) => (
            <Select
              label="Currency"
              value={money.state.value}
              disabled={issued}
              onChange={(next) => money.handleChange(next)}
              options={[
                ['EUR', 'EUR · Euro'],
                ['USD', 'USD · US dollar (draft)'],
                ['GBP', 'GBP · Pound (draft)'],
              ]}
            />
          )}
        </form.Field>
      </div>
      {correction && (
        <>
          <Field
            label="Original invoice"
            value={correction.number}
            disabled
            onChange={() => {}}
          />
          <form.Field name="correction">
            {(field) => (
              <Field
                label="Reason for correction"
                value={field.state.value?.reason ?? ''}
                disabled={issued}
                multiline
                onChange={(reason) => {
                  if (field.state.value)
                    field.handleChange({ ...field.state.value, reason });
                }}
              />
            )}
          </form.Field>
        </>
      )}
      <h3>From</h3>
      <IssuerSummary form={form} />
      {!issued && (
        <div className="iv-inline-actions">
          <Link to="/invoices/settings">
            Edit issuer settings <ArrowUpRight size={14} />
          </Link>
          <button
            onClick={() => {
              if (workspace)
                form.setFieldValue('issuer', workspace.preferences.issuer);
            }}
          >
            Apply current profile
          </button>
        </div>
      )}
      {issued && invoice.data.kind !== 'proforma' && (
        <>
          <h3>Payment record</h3>
          <p className="iv-outstanding">
            <Morph>{formatMoney(remaining, language, currency)}</Morph>
            <span>outstanding</span>
          </p>
          <button
            onClick={() => onPayment(remaining)}
            disabled={Number(remaining) <= 0}
          >
            Record payment <Plus size={15} />
          </button>
          {payments.map((payment) => (
            <div className="iv-payment" key={payment.id}>
              <span>
                {payment.date}
                <strong>
                  <Morph>
                    {formatMoney(payment.amount, language, currency)}
                  </Morph>
                </strong>
              </span>
              {payment.reversedAt ? (
                'Reversed'
              ) : (
                <button
                  disabled={pending}
                  onClick={() => {
                    reversePayment(payment.id);
                  }}
                >
                  Reverse
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => {
              rectify();
            }}
            disabled={pending}
          >
            Create rectifying invoice
          </button>
        </>
      )}
    </>
  );
});

const IssuerSummary = memo(function IssuerSummary({
  form,
}: {
  form: InvoiceForm;
}) {
  const name = useStore(form.store, (state) => state.values.issuer.name);
  const taxId = useStore(form.store, (state) => state.values.issuer.taxId);
  const regime = useStore(form.store, (state) => state.values.issuer.regime);
  return (
    <div className="iv-issuer-summary">
      <strong>{name || 'Add your legal identity'}</strong>
      <span>{taxId || 'Tax ID not set'}</span>
      <span>{regime === 'repep' ? 'REPEP · Exempt' : 'Ordinary IGIC'}</span>
    </div>
  );
});

const CustomerSection = memo(function CustomerSection({
  form,
  issued,
}: {
  form: InvoiceForm;
  issued: boolean;
}) {
  const { workspace } = useWorkspace();
  const applyCustomer = useCallback(
    (id: string) => {
      const customer = workspace?.customers.find(
        (customer) => customer.id === id,
      );
      if (!customer) return;
      form.setFieldValue('customer', customer);
      form.setFieldValue('customerId', customer.id);
      form.setFieldValue('customerType', customer.type);
      form.setFieldValue('customerTerritory', customer.territory);
      form.setFieldValue('language', customer.language);
    },
    [form, workspace],
  );
  return (
    <>
      {!issued && (
        <form.Field name="customerId">
          {(field) => (
            <Select
              label="Saved customer"
              value={field.state.value ?? ''}
              onChange={applyCustomer}
              options={[
                ['', 'Enter customer details'],
                ...(workspace?.customers ?? []).map(
                  (customer) => [customer.id, customer.name] as const,
                ),
              ]}
            />
          )}
        </form.Field>
      )}
      <form.Field name="customer">
        {(customer) => (
          <PartyFields
            value={customer.state.value}
            disabled={issued}
            onChange={(next) => customer.handleChange(next)}
          />
        )}
      </form.Field>
      <div className="iv-form-grid">
        <form.Field name="customerType">
          {(field) => (
            <Select
              label="Customer type"
              value={field.state.value}
              disabled={issued}
              onChange={(next) => field.handleChange(next)}
              options={[
                ['business', 'Business'],
                ['consumer', 'Consumer'],
              ]}
            />
          )}
        </form.Field>
        <form.Field name="customerTerritory">
          {(field) => (
            <Select
              label="Customer territory"
              value={field.state.value}
              disabled={issued}
              onChange={(next) => field.handleChange(next)}
              options={[
                ['canary-islands', 'Canary Islands'],
                ['mainland-spain', 'Mainland Spain / Balearics'],
                ['eu', 'European Union'],
                ['other', 'Other'],
              ]}
            />
          )}
        </form.Field>
      </div>
    </>
  );
});

const ItemsSection = memo(function ItemsSection({
  form,
  issued,
}: {
  form: InvoiceForm;
  issued: boolean;
}) {
  const { workspace } = useWorkspace();
  const lines = useStore(form.store, (state) => state.values.lines);
  const regime = useStore(form.store, (state) => state.values.issuer.regime);
  const updateLine = useCallback(
    (next: Line) => {
      form.setFieldValue(
        'lines',
        form.state.values.lines.map((item) =>
          item.id === next.id ? next : item,
        ),
      );
    },
    [form],
  );
  const removeLine = useCallback(
    (id: string) => {
      form.setFieldValue(
        'lines',
        form.state.values.lines.filter((item) => item.id !== id),
      );
    },
    [form],
  );
  const moveLine = useCallback(
    (id: string, offset: number) => {
      const current = [...form.state.values.lines];
      const at = current.findIndex((item) => item.id === id);
      const to = at + offset;
      if (at < 0 || to < 0 || to >= current.length) return;
      const [moved] = current.splice(at, 1);
      if (moved) current.splice(to, 0, moved);
      form.setFieldValue('lines', current);
    },
    [form],
  );
  const addLine = useCallback(() => {
    const line = newLine();
    form.setFieldValue('lines', [
      ...form.state.values.lines,
      regime === 'repep'
        ? {
            ...line,
            tax: {
              treatment: 'exempt',
              rate: '0',
              reason: 'Exención por franquicia fiscal',
            },
          }
        : line,
    ]);
  }, [form, regime]);
  const addCatalogItem = useCallback(
    (id: string) => {
      const item = workspace?.items.find((item) => item.id === id);
      if (item)
        form.setFieldValue('lines', [
          ...form.state.values.lines,
          { ...item, id: RecordId.make(crypto.randomUUID()) },
        ]);
    },
    [form, workspace],
  );
  return (
    <>
      {lines.map((line, index) => (
        <LineRow
          key={line.id}
          line={line}
          index={index}
          last={index === lines.length - 1}
          disabled={issued}
          onUpdate={updateLine}
          onRemove={removeLine}
          onMove={moveLine}
        />
      ))}
      {!issued && (
        <>
          <button className="iv-add-line" onClick={addLine}>
            <Plus size={16} />
            Add item
          </button>
          {!!workspace?.items.length && (
            <Select<string>
              label="Add from catalog"
              value=""
              onChange={addCatalogItem}
              options={[
                ['', 'Select an item'],
                ...workspace.items.map((item) => [item.id, item.name] as const),
              ]}
            />
          )}
        </>
      )}
      <h3>Adjustments</h3>
      <form.Field name="discount">
        {(discount) => (
          <div className="iv-form-grid">
            <Select
              label="Document discount"
              value={discount.state.value.kind}
              disabled={issued}
              onChange={(kind) =>
                discount.handleChange({ ...discount.state.value, kind })
              }
              options={[
                ['percent', 'Percentage'],
                ['amount', 'Fixed amount'],
              ]}
            />
            <Field
              label="Discount value"
              value={discount.state.value.value}
              disabled={issued}
              onChange={(value) =>
                discount.handleChange({ ...discount.state.value, value })
              }
            />
          </div>
        )}
      </form.Field>
    </>
  );
});

const LineRow = memo(function LineRow({
  line,
  index,
  last,
  disabled,
  onUpdate,
  onRemove,
  onMove,
}: {
  line: Line;
  index: number;
  last: boolean;
  disabled: boolean;
  onUpdate: (line: Line) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, offset: number) => void;
}) {
  const handleRemove = useCallback(
    () => onRemove(line.id),
    [onRemove, line.id],
  );
  const handleMove = useCallback(
    (offset: number) => onMove(line.id, offset),
    [onMove, line.id],
  );
  return (
    <LineEditor
      line={line}
      index={index}
      last={last}
      disabled={disabled}
      onChange={onUpdate}
      onRemove={handleRemove}
      onMove={handleMove}
    />
  );
});

const TermsSection = memo(function TermsSection({
  form,
  issued,
}: {
  form: InvoiceForm;
  issued: boolean;
}) {
  return (
    <>
      <form.Field name="reference">
        {(reference) => (
          <Field
            label="Customer reference / purchase order"
            value={reference.state.value}
            disabled={issued}
            onChange={(next) => reference.handleChange(next)}
          />
        )}
      </form.Field>
      <form.Field name="paymentTerms">
        {(terms) => (
          <Field
            label="Payment terms"
            multiline
            value={terms.state.value}
            disabled={issued}
            onChange={(next) => terms.handleChange(next)}
          />
        )}
      </form.Field>
      <form.Field name="notes">
        {(notes) => (
          <Field
            label="Notes"
            multiline
            value={notes.state.value}
            disabled={issued}
            onChange={(next) => notes.handleChange(next)}
          />
        )}
      </form.Field>
      <p className="iv-hint">
        Legal tax notes come from each item’s tax treatment. The PDF includes
        them automatically.
      </p>
    </>
  );
});

function IssueDialogBody({
  snapshot,
  error,
  pending,
  onClose,
  onIssue,
}: {
  snapshot: InvoiceData;
  error: string;
  pending: boolean;
  onClose: () => void;
  onIssue: () => void;
}) {
  const issues = useMemo(() => {
    try {
      return issueErrors(snapshot);
    } catch {
      return [{ path: 'lines', message: 'Complete all numeric values.' }];
    }
  }, [snapshot]);
  return (
    <>
      {issues.length ? (
        <div className="iv-issue-checklist">
          {issues.map((issue, index) => (
            <p key={`${issue.path}:${index}`}>
              <span>{index + 1}</span>
              {issue.message}
            </p>
          ))}
        </div>
      ) : (
        <div className="iv-ready">
          <CheckCircle2 size={24} />
          <p>The required invoice fields are complete.</p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="iv-dialog-actions">
        <button onClick={onClose} disabled={pending}>
          Back to draft
        </button>
        <button
          className="iv-primary"
          onClick={onIssue}
          disabled={pending || issues.length > 0}
        >
          {pending ? 'Issuing…' : 'Issue invoice'}
          <ArrowUpRight size={16} />
        </button>
      </div>
    </>
  );
}

const PaymentDialog = memo(function PaymentDialog({
  initialAmount,
  pending,
  error,
  onClose,
  onRecord,
}: {
  initialAmount: string;
  pending: boolean;
  error: string;
  onClose: () => void;
  onRecord: (payment: PaymentDraft) => void;
}) {
  const [payment, setPayment] = useState<PaymentDraft>({
    amount: initialAmount,
    date: new Date().toISOString().slice(0, 10),
    reference: '',
    method: 'transfer',
  });
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!pending && !open) onClose();
      }}
      title="Record payment"
      description="Record money received against this invoice."
    >
      <div className="iv-form-grid">
        <Field
          label="Amount"
          value={payment.amount}
          onChange={(amount) => setPayment({ ...payment, amount })}
        />
        <Field
          label="Payment date"
          type="date"
          value={payment.date}
          onChange={(date) => setPayment({ ...payment, date })}
        />
        <Select
          label="Method"
          value={payment.method}
          onChange={(method) => setPayment({ ...payment, method })}
          options={[
            ['transfer', 'Bank transfer'],
            ['cash', 'Cash'],
            ['card', 'Card'],
            ['other', 'Other'],
          ]}
        />
        <Field
          label="Reference"
          value={payment.reference}
          onChange={(reference) => setPayment({ ...payment, reference })}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="iv-dialog-actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="iv-primary"
          onClick={() => onRecord(payment)}
          disabled={pending}
        >
          {pending ? 'Saving…' : 'Record payment'}
        </button>
      </div>
    </Modal>
  );
});
