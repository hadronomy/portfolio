import type { Settlement } from '@portfolio/invoices/settlement';
import { stripeWebhooksLayer } from '@portfolio/invoices/stripe/webhooks';
import { ConfigProvider, Effect, Layer } from 'effect';
import { HttpRouter } from 'effect/http';
import Stripe from 'stripe';
import { afterEach, describe, expect, it } from 'vitest';
import { QueueUnavailable, Settlements } from './settlements';
import { webhookPath, webhookRoute } from './webhook';

const secret = 'whsec_test_secret';

/** The route over a queue that records what it takes, or refuses. */
function serve(queue: { refuse?: boolean } = {}) {
  const queued: Settlement[] = [];
  const settlements = Layer.succeed(
    Settlements,
    Settlements.of({
      enqueue: (items) =>
        queue.refuse
          ? Effect.fail(new QueueUnavailable({ message: 'queue down' }))
          : Effect.sync(() => {
              queued.push(...items);
            }),
    }),
  );
  const webhooks = stripeWebhooksLayer.pipe(
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({ STRIPE_WEBHOOK_SECRET: secret }),
      ),
    ),
  );
  const { handler, dispose } = HttpRouter.toWebHandler(
    webhookRoute.pipe(
      HttpRouter.provideRequest(settlements),
      HttpRouter.provideRequest(webhooks),
    ),
    { disableLogger: true },
  );
  disposers.push(dispose);
  return { handler, queued };
}

const disposers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(disposers.splice(0).map((dispose) => dispose()));
});

const event = (type: string, object: Record<string, unknown>) =>
  JSON.stringify({ id: 'evt_1', object: 'event', type, data: { object } });

async function deliver(
  handler: (request: Request) => Promise<Response>,
  payload: string,
  signature?: string,
) {
  const header =
    signature ??
    (await Stripe.webhooks.generateTestHeaderStringAsync({ payload, secret }));
  return handler(
    new Request(`https://payments.test${webhookPath}`, {
      method: 'POST',
      headers: { 'stripe-signature': header },
      body: payload,
    }),
  );
}

describe('the Stripe webhook', () => {
  it('queues the invoice an event is about, then answers 200', async () => {
    const { handler, queued } = serve();
    const response = await deliver(
      handler,
      event('invoice.paid', { object: 'invoice', id: 'in_1' }),
    );
    expect(response.status).toBe(200);
    expect(queued).toEqual([{ _tag: 'Invoice', invoice: 'in_1' }]);
  });

  it('queues a refund by the PaymentIntent it gave money back from', async () => {
    const { handler, queued } = serve();
    await deliver(
      handler,
      event('charge.refunded', {
        object: 'charge',
        id: 'ch_1',
        payment_intent: 'pi_1',
      }),
    );
    expect(queued).toEqual([{ _tag: 'Intent', intent: 'pi_1' }]);
  });

  it('acknowledges an event it has nothing to settle for', async () => {
    const { handler, queued } = serve();
    const response = await deliver(
      handler,
      event('customer.created', { object: 'customer', id: 'cus_1' }),
    );
    expect(response.status).toBe(200);
    expect(queued).toEqual([]);
  });

  it('refuses a delivery Stripe did not sign', async () => {
    const { handler, queued } = serve();
    const payload = event('invoice.paid', { object: 'invoice', id: 'in_1' });
    const forged = await deliver(handler, payload, 't=1,v1=forged');
    const missing = await handler(
      new Request(`https://payments.test${webhookPath}`, {
        method: 'POST',
        body: payload,
      }),
    );
    expect([forged.status, missing.status]).toEqual([400, 400]);
    expect(queued).toEqual([]);
  });

  it('asks Stripe to deliver again when the queue is down', async () => {
    const { handler } = serve({ refuse: true });
    const response = await deliver(
      handler,
      event('invoice.paid', { object: 'invoice', id: 'in_1' }),
    );
    expect(response.status).toBe(503);
  });

  it('answers only POST on its own path', async () => {
    const { handler } = serve();
    const response = await handler(
      new Request(`https://payments.test${webhookPath}`),
    );
    expect(response.status).toBe(404);
  });

  it('builds before Stripe has minted the signing secret', async () => {
    // Alchemy builds the Worker at deploy time, before the endpoint exists.
    const built = Layer.build(stripeWebhooksLayer).pipe(
      Effect.scoped,
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
    );
    await expect(Effect.runPromise(built)).resolves.toBeDefined();
  });
});
