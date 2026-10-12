import {
  Config,
  Context,
  Effect,
  Layer,
  Option,
  type Redacted,
  Schema,
} from 'effect';

// Everything the invoice server reads from its environment, read once, in
// one recipe. No other module touches the environment: each asks for
// AppConfig, and tests hand it whatever settings they mean.

/** Settings for the invoice server. */
export interface AppConfigApi {
  /** The public origin, when it is fixed rather than taken from the request. */
  readonly origin: string | undefined;
  readonly production: boolean;
  /** Where development keeps its database and generated secret. */
  readonly dataDirectory: string;
  /** A hosted PostgreSQL; without it, an embedded one in `dataDirectory`. */
  readonly databaseUrl: Redacted.Redacted<string> | undefined;
  /** 32 base64-encoded random bytes that sign sessions and seal sign-in state. */
  readonly secret: Redacted.Redacted<string> | undefined;
  /** Photon instance for address search: the public one unless self-hosted. */
  readonly geocoderUrl: string;
  /**
   * Stripe's publishable key, when card payments are set up. They are set
   * up only when the secret key is present too; webhooks land on the
   * payments Worker, not here.
   */
  readonly stripePublishableKey: string | undefined;
  /** Private JWKs that sign AT Protocol token requests, newest first. HTTPS deployments need one. */
  readonly atprotoKeys: readonly string[];
  /**
   * The Resend API key and sender for the invoice mail. Without it,
   * development writes each email to a file and production offers no
   * customer accounts.
   */
  readonly mail:
    | { readonly apiKey: Redacted.Redacted<string>; readonly from: string }
    | undefined;
}

/** The invoice server's settings. */
export class AppConfig extends Context.Service<AppConfig, AppConfigApi>()(
  'AppConfig',
) {}

// A JSON array of private JWKs, so a rotated key can stay listed beside its
// successor. Each goes to the plugin as its own JWK string.
const AtprotoKeys = Schema.fromJsonString(
  Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
);

const optional = <A>(config: Config.Config<A>) =>
  Config.option(config).pipe(Config.map(Option.getOrUndefined));

/** The settings, from the current ConfigProvider: the environment, unless a test says otherwise. */
export const appConfigLayer = Layer.effect(
  AppConfig,
  Effect.gen(function* () {
    const production = yield* Config.String('NODE_ENV').pipe(
      Config.map((value) => value === 'production'),
      Config.withDefault(false),
    );
    const stripe = yield* optional(
      Config.all({
        publishableKey: Config.String('STRIPE_PUBLISHABLE_KEY'),
        secretKey: Config.Redacted('STRIPE_SECRET_KEY'),
      }),
    );
    const atprotoKeys = yield* Config.schema(
      AtprotoKeys,
      'INVOICE_ATPROTO_KEYS',
    ).pipe(Config.withDefault([]));
    const settings = AppConfig.of({
      origin: yield* optional(Config.String('INVOICE_ORIGIN')),
      production,
      dataDirectory: yield* Config.String('INVOICE_DATA_DIRECTORY').pipe(
        Config.withDefault('.invoice-data'),
      ),
      databaseUrl: yield* optional(Config.Redacted('DATABASE_URL')),
      secret: yield* optional(Config.Redacted('INVOICE_SECRET')),
      geocoderUrl: yield* Config.String('INVOICE_GEOCODER_URL').pipe(
        Config.withDefault('https://photon.komoot.io'),
      ),
      stripePublishableKey: stripe?.publishableKey,
      atprotoKeys: atprotoKeys.map((jwk) => JSON.stringify(jwk)),
      mail: yield* optional(
        Config.all({
          apiKey: Config.Redacted('RESEND_API_KEY'),
          from: Config.String('INVOICE_MAIL_FROM'),
        }),
      ),
    });
    if (settings.production && (!settings.databaseUrl || !settings.secret))
      return yield* Effect.die(
        new Error(
          'Set DATABASE_URL and INVOICE_SECRET before starting invoices.',
        ),
      );
    return settings;
  }),
);

/**
 * Whether customers can have accounts here: they need mail to receive
 * codes, which development writes to files instead.
 */
export const customerAccounts = AppConfig.useSync(
  (settings) => !!settings.mail || !settings.production,
);
