import { planTerms } from '@portfolio/invoices/billing';
import {
  calculate,
  formatMoney,
  type Totals,
} from '@portfolio/invoices/calculate';
import type {
  Customer,
  Invoice,
  InvoiceData,
  Line,
  Payment,
} from '@portfolio/invoices/model';
import { newLine, quoteTerms, RecordId } from '@portfolio/invoices/model';
import { blankPages } from '@portfolio/invoices/pages';
import { issueErrors } from '@portfolio/invoices/validate';
import { useForm, useStore } from '@tanstack/react-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  Download,
  Plus,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, Reorder } from 'motion/react';
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
import {
  currencies,
  currencySymbol,
  customerTypes,
  documentKinds,
  paymentMethods,
} from './choices';
import { CoverPicker } from './cover-picker';
import { coverArt, coverLabel } from './covers';
import { LineEditor } from './line-editor';
import { PagesStudio } from './pages-studio';
import { PartyFields } from './party-fields';
import { PaymentLinkMenu, PaymentReview } from './payment-link';
import { PaymentList } from './payment-list';
import type { DockParts } from './pdf-viewer';
import { CatalogMenu, CustomerPicker } from './pickers';
import { OfferPanel, offerSummary, useOffer } from './plans';
import { QuotePanel } from './quote-panel';
import {
  AmountField,
  DueDateField,
  SeriesField,
  TerritorySelect,
} from './smart-fields';
import { type DocumentStatus, documentStatus } from './status';
import { useToast } from './toast';
import {
  Button,
  Field,
  IconButton,
  Modal,
  MorphText,
  morph,
  Section,
  Segmented,
  Select,
  StatusChip,
  Tip,
} from './ui';
import { type DraftStatus, type PreviewStatus, useDraft } from './use-draft';
import { useWorkspace } from './workspace';

const PdfViewer = lazy(() => import('./pdf-viewer'));

function useInvoiceForm(data: InvoiceData) {
  return useForm({ defaultValues: data });
}
type InvoiceForm = ReturnType<typeof useInvoiceForm>;

type PaymentMethod = Payment['method'];
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
  status: DraftStatus;
  previewStatus: PreviewStatus;
  recovery: InvoiceData | null;
  conflict: Invoice | null;
};

const longDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const day = (value: string) => longDate.format(new Date(`${value}T12:00:00Z`));

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

function useTotals(form: InvoiceForm): Totals | null {
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
      <output className="iv-message">
        {isError ? 'The invoice could not load.' : 'Loading invoice…'}
      </output>
    );
  if (!invoice)
    return (
      <div className="iv-message">
        <p>This invoice does not exist.</p>
        <Link to="/invoices" className="iv-btn" data-variant="secondary">
          <span>Back to invoices</span>
        </Link>
      </div>
    );
  return <Editor key={`${id}:${invoice.status}`} invoice={invoice} />;
}

type SectionKey =
  | 'payments'
  | 'quote'
  | 'plan'
  | 'customer'
  | 'items'
  | 'details'
  | 'terms'
  | 'from'
  | 'appearance';

function Editor({ invoice }: { invoice: Invoice }) {
  const { workspace, mutate } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const form = useInvoiceForm(invoice.data);
  const { pending, error, setError, run } = useMutationState();
  const [dialog, setDialog] = useState<'issue' | 'delete' | 'payment' | null>(
    null,
  );
  const [view, setView] = useState<'preview' | 'edit'>('preview');
  const [meta, setMeta] = useState<DraftMeta>({
    status: 'saved',
    previewStatus: 'idle',
    recovery: null,
    conflict: null,
  });
  const [snapshot, setSnapshot] = useState<InvoiceData | null>(null);
  const draftApi = useRef<DraftHandle | null>(null);
  const narrow = useNarrow();
  const issued = invoice.status === 'issued';
  const onMeta = useCallback((next: DraftMeta) => setMeta(next), []);
  const onDownloadError = useCallback(
    (message: string) => toast(message, 'error'),
    [toast],
  );
  const flush = useCallback(
    () => draftApi.current?.flush() ?? Promise.resolve(null),
    [],
  );
  const { status, remaining } = useMemo(
    () =>
      documentStatus(
        invoice,
        workspace?.payments ?? [],
        workspace?.responses ?? {},
      ),
    [invoice, workspace],
  );

  // Saving is automatic; ⌘S only saves now instead of opening the browser's
  // save-page dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 's' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      flush();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flush]);

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
      const number = result.workspace.invoices.find(
        (item) => item.id === saved.id,
      )?.number;
      setDialog(null);
      toast(number ? `Issued as ${number}` : 'Invoice issued');
      return null;
    }, 'The issue request failed. You can safely retry it.');
  }, [run, flush, mutate, toast]);

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
      toast('Draft deleted');
      return null;
    }, 'The draft could not be deleted. Try again.');
  }, [run, mutate, invoice.id, navigate, toast]);

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

  /** Runs a quote action that drafts a new document, then opens it. */
  const follow = useCallback(
    async (
      action:
        | { readonly action: 'revise' }
        | { readonly action: 'bill'; readonly payment: number },
      failure: string,
    ) => {
      await run(async () => {
        const result = await mutate({ ...action, id: invoice.id });
        if (!result.ok) return failure;
        if (result.created)
          await navigate({
            to: '/invoices/$invoiceId',
            params: { invoiceId: result.created },
          });
        return null;
      }, failure);
    },
    [run, mutate, invoice.id, navigate],
  );
  const bill = useCallback(
    (payment: number) =>
      follow(
        { action: 'bill', payment },
        'The invoice could not be drafted. Try again.',
      ),
    [follow],
  );
  const revise = useCallback(
    () =>
      follow(
        { action: 'revise' },
        'The new version could not be drafted. Try again.',
      ),
    [follow],
  );

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
        toast('Payment recorded');
        return null;
      }, 'The payment could not be saved. Check the values and try again.');
    },
    [run, mutate, invoice.id, toast],
  );

  const reversePayment = useCallback(
    async (paymentId: Payment['id']) => {
      await run(async () => {
        const result = await mutate({
          action: 'reverse-payment',
          id: paymentId,
        });
        if (!result.ok) return 'The payment could not be reversed.';
        toast('Payment reversed');
        return null;
      }, 'The payment could not be reversed.');
    },
    [run, mutate, toast],
  );

  function openIssue() {
    setError('');
    setSnapshot(form.state.values);
    setDialog('issue');
  }

  return (
    <div className="iv-editor" data-view={narrow ? view : undefined}>
      <Backdrop form={form} />
      {/* The top bar is a sibling of the stage, not a child: on narrow
          screens the stage hides while editing, and the bar still has to
          switch back to the preview. */}
      <header className="iv-topbar">
        <div className="iv-topbar-group">
          <Tip label="All invoices">
            <Link
              to="/invoices"
              className="iv-icon-btn"
              data-variant="secondary"
              aria-label="All invoices"
            >
              <ArrowLeft size={16} />
            </Link>
          </Tip>
          <div className="iv-crumb">
            {/* A draft without a title is still recognisable by who it is
                for; only a blank one is untitled. */}
            <form.Subscribe
              selector={(state) =>
                state.values.title || state.values.customer.name
              }
            >
              {(name) => (
                <span>{invoice.number ?? (name || 'Untitled draft')}</span>
              )}
            </form.Subscribe>
            <StatusChip status={status} />
          </div>
        </div>
        <div className="iv-topbar-group">
          {!issued && (
            <SaveState
              status={meta.status}
              onRetry={() => {
                flush();
              }}
            />
          )}
          {narrow && (
            <Segmented
              label="Editor view"
              value={view}
              onChange={setView}
              options={[
                ['preview', 'Preview'],
                ['edit', 'Edit'],
              ]}
            />
          )}
          <LanguageToggle form={form} />
          {!issued ? (
            <Button variant="primary" onClick={openIssue} disabled={pending}>
              Issue
            </Button>
          ) : (
            invoice.data.kind === 'invoice' &&
            Number(remaining) > 0 && (
              <Button
                variant="primary"
                onClick={() => {
                  setError('');
                  setDialog('payment');
                }}
              >
                <Plus size={15} />
                Record payment
              </Button>
            )
          )}
        </div>
      </header>
      <div className="iv-stage">
        <DraftScope
          form={form}
          invoice={invoice}
          apiRef={draftApi}
          onMeta={onMeta}
          flush={flush}
          onError={onDownloadError}
        />
      </div>
      <Inspector
        form={form}
        invoice={invoice}
        issued={issued}
        status={status}
        remaining={remaining}
        meta={meta}
        draftApi={draftApi}
        error={dialog ? '' : error}
        pending={pending}
        rectify={rectify}
        bill={bill}
        revise={revise}
        reversePayment={reversePayment}
        onDelete={() => {
          setError('');
          setDialog('delete');
        }}
        onPayment={() => {
          setError('');
          setDialog('payment');
        }}
      />
      <Modal
        open={dialog === 'issue'}
        onOpenChange={(open) => {
          if (!pending && !open) setDialog(null);
        }}
        title="Issue this invoice"
        description="Issuing gives the document its permanent number and locks it. Later corrections use a rectifying invoice."
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
        description="The draft and any unsaved changes on this device go away. Issued invoices are never affected."
      >
        {error && (
          <p className="iv-banner" role="alert">
            {error}
          </p>
        )}
        <div className="iv-dialog-actions">
          <Button onClick={() => setDialog(null)}>Keep draft</Button>
          <Button
            variant="danger"
            onClick={() => {
              remove();
            }}
            disabled={pending}
          >
            <MorphText>{pending ? 'Deleting…' : 'Delete draft'}</MorphText>
          </Button>
        </div>
      </Modal>
      <PaymentDialog
        open={dialog === 'payment'}
        remaining={remaining}
        currency={invoice.data.currency}
        pending={pending}
        error={error}
        onClose={() => setDialog(null)}
        onRecord={(payment) => {
          recordPayment(payment);
        }}
      />
    </div>
  );
}

const saveLabels: Record<DraftStatus, string> = {
  saved: 'Saved',
  local: 'Editing…',
  saving: 'Saving…',
  failed: 'Not saved',
  conflict: 'Changed elsewhere',
};

function SaveState({
  status,
  onRetry,
}: {
  status: DraftStatus;
  onRetry: () => void;
}) {
  return (
    <Tip label="Drafts save as you type" shortcut="⌘S">
      <output className="iv-save" data-state={status}>
        {status === 'saved' && <CircleCheck size={13} />}
        {(status === 'failed' || status === 'conflict') && (
          <CircleAlert size={13} />
        )}
        <MorphText>{saveLabels[status]}</MorphText>
        {status === 'failed' && (
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        )}
      </output>
    </Tip>
  );
}

const LanguageToggle = memo(function LanguageToggle({
  form,
}: {
  form: InvoiceForm;
}) {
  return (
    <form.Field name="language">
      {(language) => (
        <Segmented
          label="Document language"
          value={language.state.value}
          onChange={(next) => language.handleChange(next)}
          options={[
            ['en', 'EN'],
            ['es', 'ES'],
          ]}
        />
      )}
    </form.Field>
  );
});

/**
 * The cover art, softened, fills the room around the page. Every backdrop is
 * mounted so switching covers cross-fades instead of flashing an empty frame.
 */
const Backdrop = memo(function Backdrop({ form }: { form: InvoiceForm }) {
  const cover = useStore(form.store, (state) => state.values.cover);
  return (
    <div className="iv-backdrop" aria-hidden>
      {Object.entries(coverArt).map(([name, art]) => (
        <img
          key={name}
          src={art.backdrop}
          alt=""
          data-active={cover === name}
          decoding="async"
        />
      ))}
    </div>
  );
});

function DownloadButton({
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
    <Tip label="Download PDF" side="top">
      <a
        className="iv-icon-btn"
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
        <Download size={15} />
      </a>
    </Tip>
  );
}

function DraftScope({
  form,
  invoice,
  apiRef,
  onMeta,
  flush,
  onError,
}: {
  form: InvoiceForm;
  invoice: Invoice;
  apiRef: { current: DraftHandle | null };
  onMeta: (meta: DraftMeta) => void;
  flush: () => Promise<Invoice | null>;
  onError: (message: string) => void;
}) {
  // Stable across keystrokes, so the memoised preview below only re-renders
  // when its bytes or status change.
  const actions = useMemo(
    () => (
      <DownloadButton
        form={form}
        invoiceId={invoice.id}
        flush={flush}
        onError={onError}
      />
    ),
    [form, invoice.id, flush, onError],
  );
  return (
    <form.Subscribe selector={(state) => state.values}>
      {(values) => (
        <DraftInner
          invoice={invoice}
          values={values}
          apiRef={apiRef}
          onMeta={onMeta}
          actions={actions}
        />
      )}
    </form.Subscribe>
  );
}

const DraftInner = memo(function DraftInner({
  invoice,
  values,
  apiRef,
  onMeta,
  actions,
}: {
  invoice: Invoice;
  values: InvoiceData;
  apiRef: { current: DraftHandle | null };
  onMeta: (meta: DraftMeta) => void;
  actions: React.ReactNode;
}) {
  const draft = useDraft(invoice, values);
  const [client] = useState(() => typeof window !== 'undefined');
  const { flush, acceptServer, clearRecovery } = draft;
  useEffect(() => {
    apiRef.current = { flush, acceptServer, clearRecovery };
  }, [apiRef, flush, acceptServer, clearRecovery]);
  const { status, previewStatus, recovery, conflict, bytes } = draft;
  useEffect(() => {
    onMeta({ status, previewStatus, recovery, conflict });
  }, [status, previewStatus, recovery, conflict, onMeta]);
  return (
    <div className="iv-document">
      <PreviewBody
        client={client}
        bytes={bytes}
        previewStatus={previewStatus}
        actions={actions}
      />
    </div>
  );
});

const previewLabels: Record<PreviewStatus, string> = {
  idle: 'Waiting for valid values',
  rendering: 'Rendering…',
  outdated: 'Updating…',
  current: 'Up to date',
};

// Re-renders only when the debounced bytes or the preview status change.
const PreviewBody = memo(function PreviewBody({
  client,
  bytes,
  previewStatus,
  actions,
}: {
  client: boolean;
  bytes: string;
  previewStatus: PreviewStatus;
  actions: React.ReactNode;
}) {
  const busy = previewStatus === 'rendering' || previewStatus === 'outdated';
  const dock: DockParts = useMemo(
    () => ({
      status: (
        <span className={busy ? 'iv-shimmer' : undefined}>
          {previewLabels[previewStatus]}
        </span>
      ),
      actions,
    }),
    [busy, previewStatus, actions],
  );
  if (!client || !bytes)
    return (
      <output className="iv-stage-message">
        {previewStatus === 'idle'
          ? 'Complete the numeric values to see the document.'
          : 'Preparing the document…'}
      </output>
    );
  return (
    <Suspense
      fallback={<output className="iv-stage-message">Opening viewer…</output>}
    >
      <PdfViewer bytes={bytes} dock={dock} />
    </Suspense>
  );
});

type InspectorProps = {
  form: InvoiceForm;
  invoice: Invoice;
  issued: boolean;
  status: DocumentStatus;
  remaining: string;
  meta: DraftMeta;
  draftApi: { current: DraftHandle | null };
  error: string;
  pending: boolean;
  rectify: () => void;
  bill: (payment: number) => void;
  revise: () => void;
  reversePayment: (paymentId: Payment['id']) => void;
  onDelete: () => void;
  onPayment: () => void;
};

const Inspector = memo(function Inspector({
  form,
  invoice,
  issued,
  status,
  remaining,
  meta,
  draftApi,
  error,
  pending,
  rectify,
  bill,
  revise,
  reversePayment,
  onDelete,
  onPayment,
}: InspectorProps) {
  const totals = useTotals(form);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(() => ({
    payments: true,
    quote: true,
    plan: false,
    customer: !issued && !invoice.data.customer.name,
    items: !issued,
    details: false,
    terms: false,
    from: false,
    appearance: false,
  }));
  const toggle = (key: SectionKey) =>
    setOpen((current) => ({ ...current, [key]: !current[key] }));
  const section = (key: SectionKey) => ({
    open: open[key],
    onToggle: () => toggle(key),
  });
  return (
    <aside className="iv-inspector" aria-label="Invoice details">
      <div className="iv-inspector-head">
        <h2>
          {invoice.data.kind === 'quote'
            ? issued
              ? 'Quote'
              : 'Draft quote'
            : issued
              ? 'Invoice record'
              : 'Draft'}
        </h2>
        {!issued && (
          <IconButton label="Delete draft" onClick={onDelete}>
            <Trash2 size={15} />
          </IconButton>
        )}
      </div>
      <div className="iv-inspector-scroll">
        {error && (
          <div role="alert" className="iv-banner">
            <MorphText>{error}</MorphText>
          </div>
        )}
        {meta.recovery && (
          <div className="iv-banner" data-tone="notice">
            Unsaved changes from this device.
            <div>
              <Button
                size="sm"
                onClick={() => {
                  if (meta.recovery) form.reset(meta.recovery);
                  draftApi.current?.clearRecovery();
                }}
              >
                Restore
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  try {
                    localStorage.removeItem(`invoice-draft:${invoice.id}`);
                  } catch {
                    /* Device storage is unavailable; the saved version stays. */
                  }
                  draftApi.current?.clearRecovery();
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        )}
        {meta.conflict && (
          <div className="iv-banner" role="alert">
            Another tab saved this draft. Your edits stay on this device.
            <Button
              size="sm"
              onClick={() => {
                const server = draftApi.current?.acceptServer();
                if (server) form.reset(server);
              }}
            >
              Load saved
            </Button>
          </div>
        )}
        {invoice.data.kind === 'quote' && (
          <QuoteSection
            {...section('quote')}
            form={form}
            invoice={invoice}
            issued={issued}
            status={status}
            pending={pending}
            onBill={bill}
            onRevise={revise}
          />
        )}
        {issued && invoice.data.kind !== 'quote' && (
          <PaymentsSection
            {...section('payments')}
            form={form}
            invoice={invoice}
            status={status}
            remaining={remaining}
            pending={pending}
            rectify={rectify}
            reversePayment={reversePayment}
            onPayment={onPayment}
          />
        )}
        {/* An issued invoice is about getting paid, so the plan sits by its
            payments; a draft is still about what it charges for. */}
        {issued && (
          <PlanSection
            {...section('plan')}
            form={form}
            invoice={invoice}
            totals={totals}
          />
        )}
        <CustomerSection {...section('customer')} form={form} issued={issued} />
        <ItemsSection
          {...section('items')}
          form={form}
          issued={issued}
          totals={totals}
        />
        {!issued && (
          <PlanSection
            {...section('plan')}
            form={form}
            invoice={invoice}
            totals={totals}
          />
        )}
        <DetailsSection {...section('details')} form={form} issued={issued} />
        <TermsSection {...section('terms')} form={form} issued={issued} />
        <FromSection {...section('from')} form={form} issued={issued} />
        <AppearanceSection
          {...section('appearance')}
          form={form}
          issued={issued}
        />
      </div>
      <TotalsFoot form={form} totals={totals} />
    </aside>
  );
});

type SectionProps = {
  open: boolean;
  onToggle: () => void;
  form: InvoiceForm;
  issued: boolean;
};

const TotalsFoot = memo(function TotalsFoot({
  form,
  totals,
}: {
  form: InvoiceForm;
  totals: Totals | null;
}) {
  const currency = useStore(form.store, (state) => state.values.currency);
  const language = useStore(form.store, (state) => state.values.language);
  const money = (value: string) => formatMoney(value, language, currency);
  return (
    <div className="iv-inspector-foot" aria-live="polite">
      {totals && (
        <>
          <div className="iv-sum">
            <span>Subtotal</span>
            <MorphText>{money(totals.subtotal)}</MorphText>
          </div>
          {totals.discount !== '0.00' && (
            <div className="iv-sum">
              <span>Discount</span>
              <MorphText>{money(`-${totals.discount}`)}</MorphText>
            </div>
          )}
          {totals.groups.map((group) => (
            <div
              className="iv-sum"
              key={`${group.treatment}:${group.rate}:${group.reason}`}
            >
              <span>
                {group.treatment === 'taxable'
                  ? `IGIC ${group.rate}%`
                  : group.treatment === 'exempt'
                    ? 'Exempt'
                    : group.treatment === 'reverse-charge'
                      ? 'Reverse charge'
                      : 'Outside scope'}
              </span>
              <MorphText>{money(group.tax)}</MorphText>
            </div>
          ))}
        </>
      )}
      <div className="iv-sum-total">
        <span>Total</span>
        <strong>
          <MorphText>{totals ? money(totals.total) : '—'}</MorphText>
        </strong>
      </div>
    </div>
  );
});

const CustomerSection = memo(function CustomerSection({
  open,
  onToggle,
  form,
  issued,
}: SectionProps) {
  const { workspace } = useWorkspace();
  const name = useStore(form.store, (state) => state.values.customer.name);
  const address = useStore(
    form.store,
    (state) => state.values.customer.address,
  );
  const applyCustomer = useCallback(
    (customer: Customer) => {
      const { id, type, territory, language, ...party } = customer;
      form.setFieldValue('customer', party);
      form.setFieldValue('customerId', id);
      form.setFieldValue('customerType', type);
      form.setFieldValue('customerTerritory', territory);
      form.setFieldValue('language', language);
    },
    [form],
  );
  return (
    <Section
      title="Customer"
      summary={name || 'Not set'}
      open={open}
      onToggle={onToggle}
    >
      <div className="iv-section-body">
        {!issued && (
          <form.Field name="customerId">
            {(field) => (
              <CustomerPicker
                customers={workspace?.customers ?? []}
                selected={field.state.value}
                onPick={applyCustomer}
                onClear={() => field.handleChange(null)}
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
        <div className="iv-grid">
          <form.Field name="customerType">
            {(field) => (
              <Select
                label="Customer type"
                value={field.state.value}
                disabled={issued}
                onChange={(next) => field.handleChange(next)}
                options={customerTypes}
              />
            )}
          </form.Field>
          <form.Field name="customerTerritory">
            {(field) => (
              <TerritorySelect
                value={field.state.value}
                address={address}
                disabled={issued}
                onChange={(next) => field.handleChange(next)}
              />
            )}
          </form.Field>
        </div>
      </div>
    </Section>
  );
});

const ItemsSection = memo(function ItemsSection({
  open,
  onToggle,
  form,
  issued,
  totals,
}: SectionProps & { totals: Totals | null }) {
  const { workspace } = useWorkspace();
  const lines = useStore(form.store, (state) => state.values.lines);
  const regime = useStore(form.store, (state) => state.values.issuer.regime);
  const language = useStore(form.store, (state) => state.values.language);
  const currency = useStore(form.store, (state) => state.values.currency);
  const setLines = useCallback(
    (update: (lines: Line[]) => Line[]) =>
      form.setFieldValue('lines', update([...form.state.values.lines])),
    [form],
  );
  const updateLine = useCallback(
    (next: Line) =>
      setLines((current) =>
        current.map((item) => (item.id === next.id ? next : item)),
      ),
    [setLines],
  );
  // One line shows its editor at a time; the rest stay single rows, so the
  // list reads like the invoice. A lone line starts open: it is the one to
  // fill in.
  const [openId, setOpenId] = useState<string | null>(() =>
    lines.length === 1 ? (lines[0]?.id ?? null) : null,
  );
  const removeLine = useCallback(
    (id: string) => {
      setOpenId((current) => (current === id ? null : current));
      setLines((current) => current.filter((item) => item.id !== id));
    },
    [setLines],
  );
  const toggleLine = useCallback(
    (id: string) => setOpenId((current) => (current === id ? null : id)),
    [],
  );
  // The line just created, by any route: it opens, and its description takes
  // focus, which also scrolls it into view when it lands below the fold.
  const [fresh, setFreshId] = useState<string | null>(null);
  const setFresh = useCallback((id: string) => {
    setFreshId(id);
    setOpenId(id);
  }, []);
  // The order while a row is being dragged. The form, and with it the save
  // and the preview, only hears about the order the drag ends on.
  const [dragOrder, setDragOrderState] = useState<RecordId[] | null>(null);
  const dragged = useRef<RecordId[] | null>(null);
  const setDragOrder = useCallback((next: RecordId[]) => {
    dragged.current = next;
    setDragOrderState(next);
  }, []);
  const order = dragOrder ?? lines.map((line) => line.id);
  const dropLine = useCallback(() => {
    const final = dragged.current;
    dragged.current = null;
    setDragOrderState(null);
    if (!final) return;
    setLines((current) => {
      const byId = new Map(current.map((line) => [line.id, line]));
      const moved = final.flatMap((id) => byId.get(id) ?? []);
      // Anything added mid-drag keeps its place at the end.
      return [...moved, ...current.filter((line) => !final.includes(line.id))];
    });
  }, [setLines]);
  const duplicateLine = useCallback(
    (id: string) => {
      const copy = RecordId.make(crypto.randomUUID());
      setFresh(copy);
      setLines((current) => {
        const at = current.findIndex((item) => item.id === id);
        const source = current[at];
        if (!source) return current;
        current.splice(at + 1, 0, { ...source, id: copy });
        return current;
      });
    },
    [setLines, setFresh],
  );
  const moveLine = useCallback(
    (id: string, offset: number) =>
      setLines((current) => {
        const at = current.findIndex((item) => item.id === id);
        const to = at + offset;
        if (at < 0 || to < 0 || to >= current.length) return current;
        const [moved] = current.splice(at, 1);
        if (moved) current.splice(to, 0, moved);
        return current;
      }),
    [setLines],
  );
  const addLine = useCallback(() => {
    const line = newLine();
    setFresh(line.id);
    setLines((current) => [
      ...current,
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
  }, [setLines, regime, setFresh]);
  const count = lines.filter((line) => line.kind !== 'note').length;
  return (
    <Section
      title="Items"
      summary={`${count} item${count === 1 ? '' : 's'}`}
      open={open}
      onToggle={onToggle}
    >
      <div className="iv-section-body">
        <Reorder.Group
          as="div"
          axis="y"
          className="iv-lines"
          values={order}
          onReorder={setDragOrder}
        >
          {/* initial={false}: lines already on the invoice are simply there;
              only lines added or removed now animate. */}
          <AnimatePresence initial={false}>
            {order.map((id, index) => {
              const at = lines.findIndex((line) => line.id === id);
              const line = lines[at];
              if (!line) return null;
              return (
                <LineRow
                  key={id}
                  fresh={id === fresh}
                  line={line}
                  index={index}
                  open={id === openId}
                  disabled={issued}
                  net={totals?.lines[at]?.net ?? null}
                  language={language}
                  currency={currency}
                  onToggle={toggleLine}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                  onDuplicate={duplicateLine}
                  onMove={moveLine}
                  onDrop={dropLine}
                />
              );
            })}
          </AnimatePresence>
        </Reorder.Group>
        {!issued && (
          <div className="iv-add">
            <Button onClick={addLine}>
              <Plus size={15} />
              Add item
            </Button>
            <CatalogMenu
              items={workspace?.items ?? []}
              onPick={({ name: _name, ...item }) => {
                const id = RecordId.make(crypto.randomUUID());
                setFresh(id);
                setLines((current) => [...current, { ...item, id }]);
              }}
            />
          </div>
        )}
        <form.Field name="discount">
          {(discount) => (
            <div className="iv-grid">
              <AmountField
                label="Discount on the whole invoice"
                className="iv-span"
                value={discount.state.value.value}
                disabled={issued}
                unit={
                  discount.state.value.kind === 'percent'
                    ? '%'
                    : currencySymbol(currency)
                }
                unitSwitch={{
                  label:
                    discount.state.value.kind === 'percent'
                      ? 'Switch to a fixed amount'
                      : 'Switch to a percentage',
                  onSwitch: () =>
                    discount.handleChange({
                      ...discount.state.value,
                      kind:
                        discount.state.value.kind === 'percent'
                          ? 'amount'
                          : 'percent',
                    }),
                }}
                onChange={(value) =>
                  discount.handleChange({ ...discount.state.value, value })
                }
              />
            </div>
          )}
        </form.Field>
      </div>
    </Section>
  );
});

const LineRow = memo(function LineRow({
  fresh,
  line,
  index,
  open,
  disabled,
  net,
  language,
  currency,
  onToggle,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  onDrop,
}: {
  fresh: boolean;
  line: Line;
  index: number;
  open: boolean;
  disabled: boolean;
  net: string | null;
  language: InvoiceData['language'];
  currency: InvoiceData['currency'];
  onToggle: (id: string) => void;
  onUpdate: (line: Line) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, offset: number) => void;
  onDrop: () => void;
}) {
  const handleToggle = useCallback(
    () => onToggle(line.id),
    [onToggle, line.id],
  );
  const handleRemove = useCallback(
    () => onRemove(line.id),
    [onRemove, line.id],
  );
  const handleDuplicate = useCallback(
    () => onDuplicate(line.id),
    [onDuplicate, line.id],
  );
  const handleMove = useCallback(
    (offset: number) => onMove(line.id, offset),
    [onMove, line.id],
  );
  return (
    <LineEditor
      fresh={fresh}
      line={line}
      index={index}
      open={open}
      disabled={disabled}
      net={net}
      language={language}
      currency={currency}
      onToggle={handleToggle}
      onChange={onUpdate}
      onRemove={handleRemove}
      onDuplicate={handleDuplicate}
      onMove={handleMove}
      onDrop={onDrop}
    />
  );
});

const DetailsSection = memo(function DetailsSection({
  open,
  onToggle,
  form,
  issued,
}: SectionProps) {
  const dueDate = useStore(form.store, (state) => state.values.dueDate);
  const issueDate = useStore(form.store, (state) => state.values.issueDate);
  const correction = useStore(form.store, (state) => state.values.correction);
  const validUntil = useStore(
    form.store,
    (state) => state.values.quote?.validUntil ?? null,
  );
  return (
    <Section
      title="Dates & numbering"
      summary={
        validUntil ? `Valid until ${day(validUntil)}` : `Due ${day(dueDate)}`
      }
      open={open}
      onToggle={onToggle}
    >
      <div className="iv-section-body">
        <form.Field name="title">
          {(title) => (
            <Field
              label="Title"
              value={title.state.value}
              disabled={issued}
              onChange={(next) => title.handleChange(next)}
              placeholder="A name for this project"
            />
          )}
        </form.Field>
        <div className="iv-grid">
          <form.Field name="kind">
            {(kind) => (
              <Select
                label="Document"
                value={kind.state.value}
                disabled={issued || kind.state.value === 'rectification'}
                onChange={(next) => {
                  // A quote carries terms of its own; switching adds or drops
                  // them, so the document is always wholly one kind.
                  form.setFieldValue(
                    'quote',
                    next === 'quote'
                      ? quoteTerms(form.state.values.issueDate)
                      : null,
                  );
                  kind.handleChange(next);
                }}
                options={
                  kind.state.value === 'rectification'
                    ? [['rectification', 'Rectifying invoice']]
                    : documentKinds
                }
              />
            )}
          </form.Field>
          <form.Field name="series">
            {(series) => (
              <SeriesField
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
          {validUntil ? (
            // A quote stands until the customer answers or its validity
            // ends, which the law asks it to state.
            <form.Field name="quote">
              {(field) => (
                <DueDateField
                  label="Valid until"
                  legend="Validity, in days"
                  steps={[15, 30, 60]}
                  early="The quote must stay valid until at least its issue date."
                  issueDate={issueDate}
                  value={field.state.value?.validUntil ?? issueDate}
                  disabled={issued}
                  onChange={(next) => {
                    if (field.state.value)
                      field.handleChange({
                        ...field.state.value,
                        validUntil: next,
                      });
                  }}
                />
              )}
            </form.Field>
          ) : (
            <form.Field name="dueDate">
              {(date) => (
                <DueDateField
                  issueDate={issueDate}
                  value={date.state.value}
                  disabled={issued}
                  onChange={(next) => date.handleChange(next)}
                />
              )}
            </form.Field>
          )}
          <form.Field name="supplyDate">
            {(date) => (
              <Field
                label={validUntil ? 'Planned start' : 'Supply date'}
                type="date"
                value={date.state.value}
                disabled={issued}
                onChange={(next) => date.handleChange(next)}
                // The PDF prints a supply date only when it differs from the
                // issue date; a different one can be put back in one click.
                {...(date.state.value !== issueDate && !issued
                  ? {
                      hint: (
                        <button
                          type="button"
                          className="iv-hint-action"
                          onClick={() => date.handleChange(issueDate)}
                        >
                          Match issue date
                        </button>
                      ),
                    }
                  : {})}
              />
            )}
          </form.Field>
          {validUntil && (
            // A quote's due date is its planned delivery: the day a plan's
            // "on delivery" falls on.
            <form.Field name="dueDate">
              {(date) => (
                <Field
                  label="Planned delivery"
                  type="date"
                  value={date.state.value}
                  disabled={issued}
                  onChange={(next) => date.handleChange(next)}
                />
              )}
            </form.Field>
          )}
          <form.Field name="currency">
            {(money) => (
              <Select
                label="Currency"
                value={money.state.value}
                disabled={issued}
                onChange={(next) => money.handleChange(next)}
                options={currencies}
              />
            )}
          </form.Field>
        </div>
        <form.Field name="reference">
          {(reference) => (
            <Field
              label="Customer reference"
              value={reference.state.value}
              disabled={issued}
              placeholder="Purchase order or project code"
              onChange={(next) => reference.handleChange(next)}
            />
          )}
        </form.Field>
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
      </div>
    </Section>
  );
});

const TermsSection = memo(function TermsSection({
  open,
  onToggle,
  form,
  issued,
}: SectionProps) {
  const terms = useStore(form.store, (state) => state.values.paymentTerms);
  return (
    <Section
      title="Payment & notes"
      summary={terms.split('\n')[0] || 'None'}
      open={open}
      onToggle={onToggle}
    >
      <div className="iv-section-body">
        <form.Field name="paymentTerms">
          {(field) => (
            <Field
              label="Payment terms"
              multiline
              value={field.state.value}
              disabled={issued}
              onChange={(next) => field.handleChange(next)}
            />
          )}
        </form.Field>
        <form.Field name="notes">
          {(field) => (
            <Field
              label="Notes"
              multiline
              value={field.state.value}
              disabled={issued}
              placeholder="Thank you for your business."
              onChange={(next) => field.handleChange(next)}
            />
          )}
        </form.Field>
      </div>
    </Section>
  );
});

const FromSection = memo(function FromSection({
  open,
  onToggle,
  form,
  issued,
}: SectionProps) {
  const { workspace } = useWorkspace();
  const issuer = useStore(form.store, (state) => state.values.issuer);
  const current = workspace?.preferences.issuer;
  // A draft copies the owner's identity when it is made; the button to
  // refresh that copy only means something once settings have moved on.
  const stale = !!current && JSON.stringify(current) !== JSON.stringify(issuer);
  return (
    <Section
      title="From"
      summary={issuer.name || 'Not set'}
      open={open}
      onToggle={onToggle}
    >
      <div className="iv-section-body">
        <div className="iv-from">
          <strong>{issuer.name || 'Add your legal identity'}</strong>
          <span>{issuer.taxId || 'Tax ID not set'}</span>
          <span>
            {issuer.regime === 'repep' ? 'REPEP · Exempt' : 'Ordinary IGIC'}
          </span>
        </div>
        {!issued && (
          <div className="iv-inline">
            {stale ? (
              <Button
                size="sm"
                onClick={() => form.setFieldValue('issuer', current)}
              >
                Use current settings
              </Button>
            ) : (
              <span className="iv-muted">Matches your settings.</span>
            )}
            <Link
              to="/invoices/settings"
              className="iv-btn"
              data-variant="ghost"
              data-size="sm"
            >
              <span>Edit settings</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
      </div>
    </Section>
  );
});

const AppearanceSection = memo(function AppearanceSection({
  open,
  onToggle,
  form,
  issued,
}: SectionProps) {
  return (
    <form.Field name="cover">
      {(field) => (
        <Section
          title="Cover"
          summary={coverLabel(field.state.value)}
          open={open}
          onToggle={onToggle}
        >
          <div className="iv-section-body">
            <CoverPicker
              value={field.state.value}
              disabled={issued}
              onChange={(next) => field.handleChange(next)}
            />
          </div>
        </Section>
      )}
    </form.Field>
  );
});

const PlanSection = memo(function PlanSection({
  open,
  onToggle,
  form,
  invoice,
  totals,
}: Omit<SectionProps, 'issued'> & { invoice: Invoice; totals: Totals | null }) {
  const kind = useStore(form.store, (state) => state.values.kind);
  const currency = useStore(form.store, (state) => state.values.currency);
  const language = useStore(form.store, (state) => state.values.language);
  const issueDate = useStore(form.store, (state) => state.values.issueDate);
  const dueDate = useStore(form.store, (state) => state.values.dueDate);
  const customer = useStore(form.store, (state) => state.values.customer.name);
  const issued = invoice.status === 'issued';
  const terms =
    totals && Number(totals.total) > 0
      ? { total: totals.total, currency, issueDate, dueDate }
      : null;
  const { plans } = useOffer(invoice.id, terms, issued);
  // A rectifying invoice is settled against its original, not on a plan.
  if (kind === 'rectification') return null;
  // An issued quote's plans are part of what its customer reads and
  // accepts, so they stay as they were sent.
  if (kind === 'quote' && issued)
    return (
      <Section
        title="Payment plans"
        summary={plans.length === 1 ? '1 option' : `${plans.length} options`}
        open={open}
        onToggle={onToggle}
      >
        <div className="iv-section-body">
          <ul className="iv-plan-terms">
            {plans.map((plan) => (
              <li key={plan.id}>
                {plan.name && <strong>{plan.name}. </strong>}
                {planTerms(plan, 'en', currency, day)}
              </li>
            ))}
          </ul>
          <p className="iv-muted">
            Fixed once issued. Revise the quote to offer others.
          </p>
        </div>
      </Section>
    );
  return (
    <Section
      title="Payment plan"
      summary={offerSummary(plans, terms, language)}
      open={open}
      onToggle={onToggle}
    >
      <div className="iv-section-body">
        <OfferPanel
          id={invoice.id}
          terms={terms}
          language={language}
          issued={issued}
          title={[invoice.number ?? 'Draft', customer]
            .filter(Boolean)
            .join(' · ')}
          kind={kind}
        />
      </div>
    </Section>
  );
});

const QuoteSection = memo(function QuoteSection({
  open,
  onToggle,
  form,
  invoice,
  issued,
  status,
  pending,
  onBill,
  onRevise,
}: SectionProps & {
  invoice: Invoice;
  status: DocumentStatus;
  pending: boolean;
  onBill: (payment: number) => void;
  onRevise: () => void;
}) {
  const data = useStore(form.store, (state) => state.values);
  const [studio, setStudio] = useState(false);
  const show = (next: boolean) => morph(() => setStudio(next));
  return (
    <Section
      title="Quote"
      summary={<StatusChip status={status} />}
      open={open}
      onToggle={onToggle}
    >
      <div className="iv-section-body">
        <QuotePanel
          id={invoice.id}
          data={data}
          number={invoice.number}
          status={status}
          issued={issued}
          pending={pending}
          studioOpen={studio}
          onPages={() => show(true)}
          onBill={onBill}
          onRevise={onRevise}
        />
      </div>
      {studio && data.quote && (
        <form.Field name="quote">
          {(field) => (
            <PagesStudio
              open
              onClose={() => show(false)}
              pages={data.quote?.pages ?? blankPages}
              data={data}
              number={invoice.number}
              editable={!issued}
              onChange={(pages) => {
                const current = field.state.value;
                if (current) field.handleChange({ ...current, pages });
              }}
            />
          )}
        </form.Field>
      )}
    </Section>
  );
});

const PaymentsSection = memo(function PaymentsSection({
  open,
  onToggle,
  form,
  invoice,
  status,
  remaining,
  pending,
  rectify,
  reversePayment,
  onPayment,
}: Omit<SectionProps, 'issued'> & {
  invoice: Invoice;
  status: DocumentStatus;
  remaining: string;
  pending: boolean;
  rectify: () => void;
  reversePayment: (paymentId: Payment['id']) => void;
  onPayment: () => void;
}) {
  const { workspace } = useWorkspace();
  const currency = useStore(form.store, (state) => state.values.currency);
  const language = useStore(form.store, (state) => state.values.language);
  const payments = useMemo(
    () =>
      (workspace?.payments ?? []).filter(
        (payment) => payment.invoiceId === invoice.id,
      ),
    [workspace, invoice.id],
  );
  const money = (value: string) => formatMoney(value, language, currency);
  return (
    <Section
      title="Payments"
      summary={<StatusChip status={status} />}
      open={open}
      onToggle={onToggle}
    >
      <div className="iv-section-body">
        <div className="iv-outstanding">
          <span>Outstanding</span>
          <strong>
            <MorphText>{money(remaining)}</MorphText>
          </strong>
        </div>
        {invoice.data.kind === 'invoice' && (
          <PaymentReview
            id={invoice.id}
            currency={currency}
            language={language}
          />
        )}
        {payments.length > 0 && (
          <PaymentList
            payments={payments}
            money={money}
            day={day}
            pending={pending}
            onReverse={reversePayment}
          />
        )}
        {/* The ways to get paid share a row; correcting the invoice is a
            different act, so it sits apart, quieter. */}
        {Number(remaining) > 0 && (
          <div className="iv-inline">
            {invoice.data.kind === 'invoice' && (
              <PaymentLinkMenu
                id={invoice.id}
                outstanding={remaining}
                currency={currency}
                language={language}
                options={workspace?.offers[invoice.id]?.plans.length ?? 1}
              />
            )}
            <Button size="sm" onClick={onPayment}>
              <Plus size={14} />
              Record payment
            </Button>
          </div>
        )}
        <div className="iv-inline">
          <Button
            size="sm"
            variant="ghost"
            className="iv-flush"
            onClick={rectify}
            disabled={pending}
          >
            Create rectifying invoice
          </Button>
        </div>
      </div>
    </Section>
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
  const { issues, total } = useMemo(() => {
    try {
      return {
        issues: issueErrors(snapshot),
        total: calculate(snapshot).total,
      };
    } catch {
      return {
        issues: [{ path: 'lines', message: 'Complete every numeric value.' }],
        total: null,
      };
    }
  }, [snapshot]);
  const count = snapshot.lines.filter((line) => line.kind !== 'note').length;
  return (
    <>
      <div className="iv-review">
        <div>
          <span>Customer</span>
          <strong>{snapshot.customer.name || '—'}</strong>
        </div>
        <div>
          <span>Items</span>
          <strong>{count}</strong>
        </div>
        <div>
          <span>Due</span>
          <strong>{day(snapshot.dueDate)}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>
            {total === null
              ? '—'
              : formatMoney(total, snapshot.language, snapshot.currency)}
          </strong>
        </div>
      </div>
      {issues.length ? (
        <div className="iv-checklist">
          {issues.map((issue, index) => (
            <p key={`${issue.path}:${index}`}>
              <CircleAlert size={14} />
              {issue.message}
            </p>
          ))}
        </div>
      ) : (
        <div className="iv-ready">
          <CircleCheck size={18} />
          Every required field is complete.
        </div>
      )}
      {error && (
        <p className="iv-banner" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}
      <div className="iv-dialog-actions">
        <Button onClick={onClose} disabled={pending}>
          Back to draft
        </Button>
        <Button
          variant="primary"
          onClick={onIssue}
          disabled={pending || issues.length > 0}
        >
          <MorphText>{pending ? 'Issuing…' : 'Issue invoice'}</MorphText>
        </Button>
      </div>
    </>
  );
}

function PaymentDialog({
  open,
  remaining,
  currency,
  pending,
  error,
  onClose,
  onRecord,
}: {
  open: boolean;
  remaining: string;
  currency: InvoiceData['currency'];
  pending: boolean;
  error: string;
  onClose: () => void;
  onRecord: (payment: PaymentDraft) => void;
}) {
  const [payment, setPayment] = useState<PaymentDraft>({
    amount: remaining,
    date: new Date().toISOString().slice(0, 10),
    reference: '',
    method: 'transfer',
  });
  // Each opening starts from the balance still owed.
  useEffect(() => {
    if (open) setPayment((current) => ({ ...current, amount: remaining }));
  }, [open, remaining]);
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!pending && !next) onClose();
      }}
      title="Record payment"
      description="Money received against this invoice. The status follows from the balance."
    >
      <form
        className="iv-stack"
        onSubmit={(event) => {
          event.preventDefault();
          onRecord(payment);
        }}
      >
        <div className="iv-field">
          <span className="iv-label">Method</span>
          <Segmented
            label="Method"
            value={payment.method}
            onChange={(method) => setPayment({ ...payment, method })}
            options={paymentMethods.map(([key, text]) => [key, text] as const)}
          />
        </div>
        <div className="iv-grid">
          <AmountField
            label="Amount"
            unit={currencySymbol(currency)}
            value={payment.amount}
            onChange={(amount) => setPayment({ ...payment, amount })}
            {...(Number(payment.amount) !== Number(remaining)
              ? {
                  hint: (
                    <button
                      type="button"
                      className="iv-hint-action"
                      onClick={() =>
                        setPayment({ ...payment, amount: remaining })
                      }
                    >
                      Use the balance,{' '}
                      <span className="iv-num">
                        {formatMoney(remaining, 'en', currency)}
                      </span>
                    </button>
                  ),
                }
              : {})}
          />
          <Field
            label="Date"
            type="date"
            value={payment.date}
            onChange={(date) => setPayment({ ...payment, date })}
          />
          <Field
            className="iv-span"
            label="Reference"
            placeholder="Bank reference or note"
            value={payment.reference}
            onChange={(reference) => setPayment({ ...payment, reference })}
          />
        </div>
        {error && (
          <p className="iv-banner" role="alert">
            {error}
          </p>
        )}
        <div className="iv-dialog-actions" style={{ marginTop: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            <MorphText>{pending ? 'Saving…' : 'Record payment'}</MorphText>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
