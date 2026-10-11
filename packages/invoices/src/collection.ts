import { createHash, randomBytes } from 'node:crypto';
import Decimal from 'decimal.js';
import { and, asc, eq, gt, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { Context, Effect, Layer, Schema } from 'effect';
import { balance, calculate } from './calculate';
import {
  type AttemptId,
  Checkout,
  type CheckoutInvoice,
  CollectionStatus,
  PayFailure,
  Review,
} from './collection-model';
import { InvoiceDatabase } from './database';
import { documentLabels } from './labels';
import {
  type Actor,
  type Invoice,
  InvoiceId,
  type OwnerDid,
  type Payment,
  RecordId,
  StorageFailure,
} from './model';
import { partyLines } from './party-lines';
import {
  allows,
  type InvoiceOffer,
  inFull,
  offered,
  options,
  schedule,
  termsOf,
} from './plan';
import { Settlement } from './settlement';
import { decodeStored, stored } from './storage';
import { InvoiceStore, type StoreError } from './store';
import { StripeGateway } from './stripe/gateway';
import {
  customerDetails,
  differences,
  fromMinor,
  project,
  projectionVersion,
  toMinor,
} from './stripe/projection';
import {
  StripeCustomerId,
  type StripeFailure,
  type StripeInvoice,
  StripeInvoiceId,
  type StripeInvoicePayment,
} from './stripe/schema';
import * as tables from './tables';

// Collection puts an issued invoice up for payment and keeps the ledger in
// step with what Stripe received. The local invoice stays the record: Stripe
// holds a faithful copy that can take a payment, and every payment it settles
// comes back here as an ordinary payment, recorded once.
//
// Each step is safe to repeat. The row in `invoice_collections` says how far
// the work got, and every Stripe write carries an idempotency key derived from
// the invoice or the customer's attempt, so a retry after a crash or a double
// click finishes the same work instead of starting new work.

/** An invoice that cannot be put up for payment, and why. */
export class NotCollectible extends Schema.TaggedError<NotCollectible>()(
  'NotCollectible',
  {
    reason: Schema.Literals([
      'draft',
      'proforma',
      'rectification',
      'nothing-due',
      'partly-paid',
      'paid',
      'in-review',
    ]),
  },
) {}

/** Stripe's draft disagreed with the invoice; nothing was finalized. */
export class ProjectionMismatch extends Schema.TaggedError<ProjectionMismatch>()(
  'ProjectionMismatch',
  { review: Review },
) {}

/**
 * A payment link that does not open: unknown, expired, or revoked. The three
 * are one error on purpose, so a guessed token learns nothing.
 */
export class LinkInvalid extends Schema.TaggedError<LinkInvalid>()(
  'LinkInvalid',
  {},
) {}

/** A payment the page asked for and collection would not start. */
export class PaymentRefused extends Schema.TaggedError<PaymentRefused>()(
  'PaymentRefused',
  { failure: PayFailure },
) {}

export type CollectionError =
  | StoreError
  | StripeFailure
  | NotCollectible
  | ProjectionMismatch;

/** A link's opaque token, as the customer's URL carries it. */
export const LinkToken = Schema.String.check(
  Schema.isPattern(/^[\w-]{43}$/),
).pipe(Schema.brand('LinkToken'));
export type LinkToken = typeof LinkToken.Type;

export interface CollectionApi {
  /**
   * Puts an issued invoice up for payment and returns a new link for its
   * customer. Repeating it finishes interrupted work and mints another link;
   * every link stays valid until it expires or is revoked.
   */
  readonly share: (
    id: InvoiceId,
    actor: OwnerDid,
  ) => Effect.Effect<
    { readonly token: LinkToken; readonly status: CollectionStatus },
    CollectionError
  >;
  /** Closes every open link to the invoice and returns how many there were. */
  readonly revoke: (
    id: InvoiceId,
    actor: OwnerDid,
  ) => Effect.Effect<number, StorageFailure>;
  /** Where the invoice's collection stands. */
  readonly status: (
    id: InvoiceId,
  ) => Effect.Effect<CollectionStatus, StorageFailure>;
  /** The invoice a link opens, while it is valid. */
  readonly resolve: (
    token: string,
  ) => Effect.Effect<InvoiceId, LinkInvalid | StorageFailure>;
  /**
   * What the customer's page shows for the invoice, and what they may pay
   * now under its plan. Callers decide who may see it: a link, or an
   * account the invoice is billed to. An invoice nobody shared yet is put
   * up for payment here, so a signed-in customer can pay it straight away.
   */
  readonly checkout: (
    id: InvoiceId,
  ) => Effect.Effect<Checkout, CollectionError>;
  /**
   * Starts a payment of `amount` under `plan` and returns the secret the
   * browser confirms it with. The amount must be one that plan allows now,
   * and the plan becomes the customer's choice. Each `attempt` is created
   * once; starting a new one cancels any the customer abandoned, so two can
   * never both be paid.
   */
  readonly pay: (
    id: InvoiceId,
    request: {
      readonly amount: string;
      readonly attempt: AttemptId;
      readonly plan: RecordId;
    },
  ) => Effect.Effect<
    { readonly clientSecret: string },
    PaymentRefused | CollectionError
  >;
  /**
   * Brings the ledger in line with every payment and refund Stripe holds for
   * the Stripe invoice `settlement` names, then adopts its state. Reading
   * Stripe, not an event, makes it safe in any order and any number of
   * times. Returns null for a Stripe invoice this workspace did not make.
   */
  readonly settle: (
    settlement: Settlement,
  ) => Effect.Effect<CollectionStatus | null, CollectionError>;
  /**
   * The settlements a reconciliation pass runs, oldest first: every
   * collection whose Stripe invoice can still change, which is every one not
   * yet paid, and a paid one for a while after, since it can still be
   * refunded. A pass catches whatever a lost webhook left behind.
   */
  readonly unsettled: () => Effect.Effect<
    readonly Settlement[],
    StorageFailure
  >;
}

/** Payment collection for issued invoices, through Stripe. */
export class Collection extends Context.Service<Collection, CollectionApi>()(
  'Collection',
) {}

/** How long a payment link opens. */
export const linkLifetime = 30 * 86_400_000;

/** How long a paid collection is still reconciled: Stripe takes refunds for months, but almost all come within weeks. */
const refundWindow = 60 * 86_400_000;

/** The most settlements one reconciliation pass returns; the oldest come first, so the rest wait for the next pass. */
const reconcileLimit = 200;

const stripeActor: Actor = 'system:stripe';
const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/**
 * The ledger ID for a Stripe invoice payment, net of `refunded`. Deriving
 * it, rather than drawing one, is what makes recording the same payment
 * twice a no-op; a refund changes the amount, and with it the ID.
 */
export function paymentRecordId(payment: string, refunded = 0) {
  const source = refunded ? `${payment}:refunded:${refunded}` : payment;
  const hex = createHash('sha256').update(`stripe:${source}`).digest('hex');
  // UUID v8: the layout is fixed, the bits are ours.
  return RecordId.make(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  );
}

// A PaymentIntent in these states has not taken money and can still be
// canceled. `processing` cannot: the money is already on its way.
const abandonable = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
]);

const Row = Schema.Struct({
  invoiceId: InvoiceId,
  customerKey: Schema.String,
  stripeCustomer: Schema.NullOr(StripeCustomerId),
  stripeInvoice: Schema.NullOr(StripeInvoiceId),
  state: Schema.Literals(['preparing', 'open', 'paid', 'review']),
  review: Schema.NullOr(Review),
});
type Row = typeof Row.Type;
const decodeRow = decodeStored(Row);

/** The state a Stripe invoice puts its collection in. */
function adopt(invoice: StripeInvoice): Pick<Row, 'state' | 'review'> {
  switch (invoice.status) {
    case 'draft':
      return { state: 'preparing', review: null };
    case 'open':
      return { state: 'open', review: null };
    case 'paid':
      return { state: 'paid', review: null };
    case 'void':
    case 'uncollectible':
      return {
        state: 'review',
        review: Review.cases.Closed.make({ status: invoice.status }),
      };
  }
}

/** Why an invoice cannot be collected at all, whatever Stripe says. */
function refusal(invoice: Invoice): NotCollectible['reason'] | null {
  if (invoice.status !== 'issued') return 'draft';
  if (invoice.data.kind !== 'invoice') return invoice.data.kind;
  if (!new Decimal(calculate(invoice.data).total).gt(0)) return 'nothing-due';
  return null;
}

function summary(
  invoice: Invoice,
  payments: readonly Payment[],
): CheckoutInvoice {
  const { data } = invoice;
  const totals = calculate(data);
  const { language } = data;
  const home = data.issuer.address.country;
  const taxLabel = documentLabels[language].taxId;
  const active = payments
    .filter((payment) => !payment.reversedAt)
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    number: invoice.number ?? '',
    title: data.title,
    issuer: data.issuer.name,
    issuerEmail: data.issuer.email,
    issuerLines: partyLines(data.issuer, { home, language, taxLabel }),
    customerLines: partyLines(data.customer, { home, language, taxLabel }),
    customer: data.customer.name,
    customerEmail: data.customer.email,
    customerCountry: data.customer.address.country,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    language: data.language,
    currency: data.currency,
    cover: data.cover,
    lines: data.lines.flatMap((line, index) => {
      const amounts = totals.lines[index];
      if (line.kind === 'note' || !amounts) return [];
      return [
        {
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          amount: new Decimal(amounts.gross).minus(amounts.discount).toFixed(2),
        },
      ];
    }),
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxes: totals.groups
      .filter(
        (group) =>
          group.treatment === 'taxable' && !new Decimal(group.tax).isZero(),
      )
      .map(({ rate, tax }) => ({ rate, amount: tax })),
    withholding: totals.withholding,
    disbursements: totals.disbursements,
    total: totals.total,
    payments: active.map(({ date, amount }) => ({ date, amount })),
    remaining: balance(totals.total, payments),
    notes: data.notes,
  };
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Where the invoice stands under each plan the customer may still pay by,
 * and what each lets them pay now. A choice binds once money has landed.
 */
function standing(invoice: Invoice, offer: InvoiceOffer, remaining: string) {
  const { total } = calculate(invoice.data);
  const terms = termsOf(invoice, total);
  const paid = new Decimal(total).minus(remaining).toFixed(2);
  const plans = offered(offer.plans, terms);
  const chosen = plans.find((plan) => plan.id === offer.chosen);
  const locked = !!chosen && new Decimal(paid).gt(0);
  const open = chosen && locked ? [chosen] : plans;
  return {
    plans: open.map((plan) => {
      const current = schedule(plan, terms, paid, today());
      return {
        id: plan.id,
        name: plan.name,
        schedule: current,
        options: options(current, terms),
      };
    }),
    selected: (chosen ?? open[0] ?? inFull).id,
    locked,
  };
}

const makeCollection = Effect.gen(function* () {
  const store = yield* InvoiceStore;
  const stripe = yield* StripeGateway;
  const db = yield* InvoiceDatabase;

  const row = (id: InvoiceId) =>
    stored(
      db
        .select()
        .from(tables.collections)
        .where(eq(tables.collections.invoiceId, id)),
    ).pipe(
      Effect.flatMap(([found]) =>
        found ? decodeRow(found) : Effect.succeed(null),
      ),
    );

  const write = (id: InvoiceId, change: Partial<Omit<Row, 'invoiceId'>>) =>
    stored(
      db
        .update(tables.collections)
        .set({ ...change, updatedAt: new Date().toISOString() })
        .where(eq(tables.collections.invoiceId, id))
        .returning(),
    ).pipe(Effect.flatMap(([updated]) => decodeRow(updated)));

  /** Creates the row on first use; a concurrent request finds the same one. */
  const start = (invoice: Invoice) =>
    stored(
      db
        .insert(tables.collections)
        .values({
          invoiceId: invoice.id,
          // Invoices for one directory customer share one Stripe customer.
          customerKey: invoice.data.customerId ?? `invoice:${invoice.id}`,
          state: 'preparing',
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoNothing(),
    ).pipe(
      Effect.andThen(row(invoice.id)),
      Effect.flatMap((found) =>
        found
          ? Effect.succeed(found)
          : Effect.fail(
              new StorageFailure({ message: 'The collection was not saved.' }),
            ),
      ),
    );

  const knownCustomer = (key: string) =>
    stored(
      db
        .select({ id: tables.collections.stripeCustomer })
        .from(tables.collections)
        .where(
          and(
            eq(tables.collections.customerKey, key),
            isNotNull(tables.collections.stripeCustomer),
          ),
        )
        .limit(1),
    ).pipe(
      Effect.flatMap(([found]) =>
        found ? decodeStored(StripeCustomerId)(found.id) : Effect.succeed(null),
      ),
    );

  const openLinks = (id: InvoiceId) =>
    stored(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tables.links)
        .where(
          and(
            eq(tables.links.invoiceId, id),
            isNull(tables.links.revokedAt),
            gt(tables.links.expiresAt, new Date().toISOString()),
          ),
        ),
    ).pipe(Effect.map(([found]) => found?.count ?? 0));

  const statusOf = Effect.fnUntraced(function* (current: Row | null) {
    if (!current) return CollectionStatus.cases.Idle.make({});
    switch (current.state) {
      case 'preparing':
        return CollectionStatus.cases.Preparing.make({});
      case 'open':
        return CollectionStatus.cases.Open.make({
          links: yield* openLinks(current.invoiceId),
        });
      case 'paid':
        return CollectionStatus.cases.Paid.make({});
      case 'review':
        return current.review
          ? CollectionStatus.cases.Review.make({ review: current.review })
          : CollectionStatus.cases.Preparing.make({});
    }
  });

  /** Gets the Stripe invoice to finalized, from wherever it was left. */
  const prepare = Effect.fn('Collection.prepare')(function* (
    invoice: Invoice,
    current: Row,
  ) {
    const projection = project(invoice);
    const key = (step: string) =>
      `invoice/${invoice.id}/${projectionVersion}/${step}`;

    let stripeInvoice = current.stripeInvoice
      ? yield* stripe.read(current.stripeInvoice)
      : yield* stripe.find(invoice.id);
    if (!stripeInvoice) {
      const customer = yield* stripe.customer({
        id:
          current.stripeCustomer ?? (yield* knownCustomer(current.customerKey)),
        details: customerDetails(
          invoice.data.customer,
          invoice.data.language,
          current.customerKey,
        ),
        key: key('customer'),
      });
      yield* write(invoice.id, { stripeCustomer: customer });
      stripeInvoice = yield* stripe.draft(
        { ...projection.draft, customer },
        key('draft'),
      );
    }
    yield* write(invoice.id, { stripeInvoice: stripeInvoice.id });

    if (stripeInvoice.status === 'draft') {
      // Lines go in one atomic request, so a draft has all of them or none.
      if (stripeInvoice.lines.data.length === 0)
        stripeInvoice = yield* stripe.addLines(
          stripeInvoice.id,
          projection.lines,
          key('lines'),
        );
      const found = differences(projection.expected, stripeInvoice);
      if (found.length) {
        const review = Review.cases.Mismatch.make({ differences: found });
        yield* write(invoice.id, { state: 'review', review });
        return yield* new ProjectionMismatch({ review });
      }
      stripeInvoice = yield* stripe.finalize(stripeInvoice.id, key('finalize'));
    }
    return yield* write(invoice.id, adopt(stripeInvoice));
  });

  /** Records what Stripe settled of one payment, once, net of refunds. */
  const record = (
    invoice: InvoiceId,
    payment: StripeInvoicePayment,
    refunded: number,
    amount: number,
  ) =>
    store.payment(
      {
        id: paymentRecordId(payment.id, refunded),
        invoiceId: invoice,
        amount: fromMinor(amount),
        date: new Date((payment.paidAt ?? Date.now() / 1000) * 1000)
          .toISOString()
          .slice(0, 10),
        method: 'stripe',
        reference: payment.id,
        createdAt: new Date().toISOString(),
        reversedAt: null,
      },
      stripeActor,
    );

  const settleInvoice = Effect.fn('Collection.settleInvoice')(function* (
    id: StripeInvoiceId,
  ) {
    const stripeInvoice = yield* stripe.read(id);
    const local = Schema.decodeUnknownOption(InvoiceId)(
      stripeInvoice.metadata.invoice,
    );
    if (local._tag === 'None') return null;
    const current = yield* row(local.value);
    if (!current || current.stripeInvoice !== id) return null;

    const ledger = yield* store.payments(local.value);
    let refundedTotal = 0;
    for (const payment of yield* stripe.payments(id)) {
      if (payment.status !== 'paid' || !payment.amountPaid) continue;
      const refunded = Math.min(payment.refunded, payment.amountPaid);
      refundedTotal += refunded;
      const kept = paymentRecordId(payment.id, refunded);
      // A refund replaces the payment's record with one for what is left:
      // the earlier record is reversed first, so the ledger never holds both.
      for (const earlier of ledger)
        if (
          earlier.reference === payment.id &&
          earlier.id !== kept &&
          !earlier.reversedAt
        )
          yield* store.reversePayment(earlier.id, stripeActor);
      if (payment.amountPaid - refunded <= 0) continue;
      const recorded = yield* record(
        local.value,
        payment,
        refunded,
        payment.amountPaid - refunded,
      ).pipe(
        Effect.as(true),
        // The ledger refuses a payment larger than what is outstanding: the
        // owner recorded another payment after sharing the link.
        Effect.catchTag('InvalidInvoice', () => Effect.succeed(false)),
      );
      if (!recorded)
        return yield* statusOf(
          yield* write(local.value, {
            state: 'review',
            review: Review.cases.Overpaid.make({ payment: payment.id }),
          }),
        );
    }
    return yield* statusOf(
      yield* write(
        local.value,
        refundedTotal > 0
          ? {
              state: 'review',
              review: Review.cases.Refunded.make({
                amount: fromMinor(refundedTotal),
              }),
            }
          : adopt(stripeInvoice),
      ),
    );
  });

  /** Gets the invoice payable through Stripe, from wherever it was left. */
  const open = Effect.fn('Collection.open')(function* (invoice: Invoice) {
    const refused = refusal(invoice);
    if (refused) return yield* new NotCollectible({ reason: refused });
    const current = (yield* row(invoice.id)) ?? (yield* start(invoice));
    if (current.state === 'paid')
      return yield* new NotCollectible({ reason: 'paid' });
    if (current.state === 'review')
      return yield* new NotCollectible({ reason: 'in-review' });
    if (current.state === 'open') return current;
    // Stripe would ask for the full amount: a payment the ledger already
    // holds has to be settled with the customer first.
    const payments = yield* store.payments(invoice.id);
    if (payments.some((payment) => !payment.reversedAt))
      return yield* new NotCollectible({ reason: 'partly-paid' });
    return yield* prepare(invoice, current);
  });

  const share = Effect.fn('Collection.share')(function* (
    id: InvoiceId,
    actor: OwnerDid,
  ) {
    const current = yield* open(yield* store.read(id));
    const token = LinkToken.make(randomBytes(32).toString('base64url'));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + linkLifetime).toISOString();
    yield* stored(
      db.transaction((tx) =>
        Effect.gen(function* () {
          yield* tx.insert(tables.links).values({
            tokenHash: hash(token),
            invoiceId: id,
            expiresAt,
            createdAt: now.toISOString(),
          });
          yield* tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: id,
            operation: 'payment-link-created',
            actor,
            payload: { expiresAt },
            createdAt: now.toISOString(),
          });
        }),
      ),
    );
    return { token, status: yield* statusOf(current) };
  });

  const revoke = Effect.fn('Collection.revoke')(function* (
    id: InvoiceId,
    actor: OwnerDid,
  ) {
    const now = new Date().toISOString();
    return yield* stored(
      db.transaction((tx) =>
        Effect.gen(function* () {
          const closed = yield* tx
            .update(tables.links)
            .set({ revokedAt: now })
            .where(
              and(
                eq(tables.links.invoiceId, id),
                isNull(tables.links.revokedAt),
                gt(tables.links.expiresAt, now),
              ),
            )
            .returning();
          if (closed.length)
            yield* tx.insert(tables.audit).values({
              id: crypto.randomUUID(),
              invoiceId: id,
              operation: 'payment-links-revoked',
              actor,
              payload: { count: closed.length },
              createdAt: now,
            });
          return closed.length;
        }),
      ),
    );
  });

  const resolve = Effect.fn('Collection.resolve')(function* (token: string) {
    if (!Schema.is(LinkToken)(token)) return yield* new LinkInvalid();
    const [link] = yield* stored(
      db
        .select({ invoiceId: tables.links.invoiceId })
        .from(tables.links)
        .where(
          and(
            eq(tables.links.tokenHash, hash(token)),
            isNull(tables.links.revokedAt),
            gt(tables.links.expiresAt, new Date().toISOString()),
          ),
        ),
    );
    if (!link) return yield* new LinkInvalid();
    return InvoiceId.make(link.invoiceId);
  });

  /** The invoice, its collection, and Stripe's copy, with the ledger caught up. */
  const current = Effect.fnUntraced(function* (id: InvoiceId) {
    const invoice = yield* store.read(id);
    const collection = yield* row(id);
    if (!collection?.stripeInvoice) return null;
    const owed = (payments: readonly Payment[]) =>
      toMinor(balance(calculate(invoice.data).total, payments));
    let stripeInvoice = yield* stripe.read(collection.stripeInvoice);
    let payments = yield* store.payments(id);
    // The ledger and Stripe must agree on what is owed before the customer
    // may pay it. A payment Stripe has and the ledger lacks is settled now;
    // anything else stays a disagreement, and payment stays closed.
    if (stripeInvoice.amountRemaining !== owed(payments)) {
      yield* settleInvoice(stripeInvoice.id);
      stripeInvoice = yield* stripe.read(collection.stripeInvoice);
      payments = yield* store.payments(id);
    }
    return {
      invoice,
      collection: (yield* row(id)) ?? collection,
      stripeInvoice,
      payments,
      owed: owed(payments),
      agreed: stripeInvoice.amountRemaining === owed(payments),
    };
  });

  /** The invoice and its Stripe copy, opening it for payment if nobody has. */
  const opened = Effect.fnUntraced(function* (invoice: Invoice) {
    const found = yield* current(invoice.id);
    if (found) return found;
    // Paid some other way, or not a request for payment: there is nothing
    // to put up, and starting would leave a half-made collection behind.
    const payments = yield* store.payments(invoice.id);
    if (
      refusal(invoice) ||
      payments.some((payment) => !payment.reversedAt) ||
      !new Decimal(balance(calculate(invoice.data).total, payments)).gt(0)
    )
      return null;
    const made = yield* open(invoice).pipe(
      Effect.as(true),
      Effect.catchTags({
        NotCollectible: () => Effect.succeed(false),
        ProjectionMismatch: () => Effect.succeed(false),
      }),
    );
    return made ? yield* current(invoice.id) : null;
  });

  const checkout = Effect.fn('Collection.checkout')(function* (id: InvoiceId) {
    const stored = yield* store.read(id);
    const found = yield* opened(stored);
    if (!found) {
      const invoice = stored;
      const payments = yield* store.payments(id);
      const view = summary(invoice, payments);
      return new Decimal(view.remaining).gt(0)
        ? Checkout.cases.Unavailable.make({ invoice: view })
        : Checkout.cases.Paid.make({ invoice: view });
    }
    const { invoice, collection, stripeInvoice, payments, owed } = found;
    const view = summary(invoice, payments);
    if (stripeInvoice.status === 'paid' && owed <= 0)
      return Checkout.cases.Paid.make({ invoice: view });
    if (
      collection.state === 'review' ||
      stripeInvoice.status !== 'open' ||
      !found.agreed
    )
      return Checkout.cases.Unavailable.make({ invoice: view });
    const inFlight = (yield* stripe.payments(stripeInvoice.id)).find(
      (payment) =>
        payment.status === 'open' && payment.intent?.status === 'processing',
    );
    if (inFlight)
      return Checkout.cases.Processing.make({
        invoice: view,
        amount: fromMinor(inFlight.amountRequested),
      });
    return Checkout.cases.Payable.make({
      invoice: view,
      ...standing(invoice, yield* store.offer(id), view.remaining),
    });
  });

  const refuse = (failure: PayFailure) => new PaymentRefused({ failure });

  const pay = Effect.fn('Collection.pay')(function* (
    id: InvoiceId,
    request: {
      readonly amount: string;
      readonly attempt: AttemptId;
      readonly plan: RecordId;
    },
  ) {
    const found = yield* current(id);
    if (
      !found?.collection.stripeCustomer ||
      found.collection.state !== 'open' ||
      found.stripeInvoice.status !== 'open' ||
      !found.agreed
    )
      return yield* refuse(PayFailure.cases.Changed.make({}));
    const { invoice, stripeInvoice, owed } = found;
    const customer = found.collection.stripeCustomer;

    const amount = (() => {
      try {
        return toMinor(request.amount);
      } catch {
        return null;
      }
    })();
    // The page offered what the plans allowed when it loaded; a plan no
    // longer open, or an amount it does not allow now, means the invoice
    // moved on under it.
    const allowed = standing(
      invoice,
      yield* store.offer(id),
      fromMinor(owed),
    ).plans.find((plan) => plan.id === request.plan)?.options;
    if (!allowed || amount === null || !allows(allowed, fromMinor(amount)))
      return yield* refuse(PayFailure.cases.Changed.make({}));
    yield* store.choose(id, request.plan, 'customer');

    const attempts = yield* stripe.payments(stripeInvoice.id);
    if (
      attempts.some(
        (payment) =>
          payment.status === 'open' && payment.intent?.status === 'processing',
      )
    )
      return yield* refuse(PayFailure.cases.Changed.make({}));

    const key = (step: string) =>
      `invoice/${invoice.id}/attempt/${request.attempt}/${step}`;
    const intent = yield* stripe.intent(
      {
        amount,
        currency: invoice.data.currency.toLowerCase(),
        customer,
        automatic_payment_methods: { enabled: true },
        ...(invoice.number ? { description: invoice.number } : {}),
        metadata: { invoice: invoice.id, attempt: request.attempt },
      },
      key('intent'),
    );
    for (const attempt of attempts)
      if (
        attempt.status === 'open' &&
        !attempt.isDefault &&
        attempt.intent &&
        attempt.intent.id !== intent.id &&
        abandonable.has(attempt.intent.status)
      )
        yield* stripe.cancel(attempt.intent.id);
    yield* stripe.attach(stripeInvoice.id, intent.id, key('attach'));
    return { clientSecret: intent.clientSecret };
  });

  const settle = Effect.fn('Collection.settle')(function* (
    settlement: Settlement,
  ) {
    const id =
      settlement._tag === 'Invoice'
        ? settlement.invoice
        : yield* stripe.invoiceOf(settlement.intent);
    return id ? yield* settleInvoice(id) : null;
  });

  const unsettled = Effect.fn('Collection.unsettled')(function* () {
    const since = new Date(Date.now() - refundWindow).toISOString();
    const rows = yield* stored(
      db
        .select({ invoice: tables.collections.stripeInvoice })
        .from(tables.collections)
        .where(
          and(
            isNotNull(tables.collections.stripeInvoice),
            or(
              ne(tables.collections.state, 'paid'),
              gt(tables.collections.updatedAt, since),
            ),
          ),
        )
        .orderBy(asc(tables.collections.updatedAt))
        .limit(reconcileLimit),
    );
    return yield* Effect.forEach(rows, (row) =>
      decodeStored(StripeInvoiceId)(row.invoice).pipe(
        Effect.map((invoice) => Settlement.cases.Invoice.make({ invoice })),
      ),
    );
  });

  return Collection.of({
    share,
    revoke,
    status: (id) => row(id).pipe(Effect.flatMap(statusOf)),
    resolve,
    checkout,
    pay,
    settle,
    unsettled,
  });
});

/** Collection over the store, the database, and a Stripe gateway. */
export const collectionLayer = Layer.effect(Collection, makeCollection);
