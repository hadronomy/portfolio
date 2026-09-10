import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  NodeSavedSession,
  NodeSavedState,
} from '@atproto/oauth-client-node';
import { openDatabase } from '@portfolio/invoices/database';
import { makeStore } from '@portfolio/invoices/store';
import { secrets } from '@portfolio/invoices/tables';
import { eq } from 'drizzle-orm';
import { Config, Effect, Option, Schema } from 'effect';

/** Process-environment settings for the invoice backend, read through Effect Config so domain code never touches process.env. */
export interface AppConfig {
  readonly origin: string | undefined;
  readonly production: boolean;
  readonly dataDirectory: string;
  readonly databaseUrl: string | undefined;
  readonly secret: string | undefined;
}

/** Loads the invoice backend settings from the process environment through a single Effect Config recipe. */
export function appConfig(): AppConfig {
  const recipe = Effect.gen(function* () {
    const origin = yield* Config.option(Config.string('INVOICE_ORIGIN'));
    const nodeEnv = yield* Config.option(Config.string('NODE_ENV'));
    const dataDirectory = yield* Config.option(
      Config.string('INVOICE_DATA_DIRECTORY'),
    );
    const databaseUrl = yield* Config.option(Config.string('DATABASE_URL'));
    const secret = yield* Config.option(Config.string('INVOICE_SECRET'));
    return { origin, nodeEnv, dataDirectory, databaseUrl, secret };
  });
  const loaded = Effect.runSync(recipe);
  return {
    origin: Option.getOrUndefined(loaded.origin),
    production: Option.getOrUndefined(loaded.nodeEnv) === 'production',
    dataDirectory:
      Option.getOrUndefined(loaded.dataDirectory) ?? '.invoice-data',
    databaseUrl: Option.getOrUndefined(loaded.databaseUrl),
    secret: Option.getOrUndefined(loaded.secret),
  };
}

/** Atproto owns the OAuth session shape and AES-GCM already authenticates the bytes, so this codec only checks the envelope before handing the value back. */
export const NodeSessionCodec = Schema.declare<NodeSavedSession>(
  (input): input is NodeSavedSession =>
    typeof input === 'object' && input !== null,
);

/** Atproto owns the OAuth state shape and AES-GCM already authenticates the bytes, so this codec only checks the envelope before handing the value back. */
export const NodeStateCodec = Schema.declare<NodeSavedState>(
  (input): input is NodeSavedState =>
    typeof input === 'object' && input !== null,
);

async function initialize() {
  const settings = appConfig();
  const directory = resolve(settings.dataDirectory);
  if (settings.production && (!settings.databaseUrl || !settings.secret))
    throw new Error(
      'Set DATABASE_URL and INVOICE_SECRET before starting invoices.',
    );
  let key: Buffer;
  if (settings.secret) {
    key = Buffer.from(settings.secret, 'base64');
  } else {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = resolve(directory, 'encryption.key');
    try {
      key = await readFile(path);
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
      )
        throw error;
      key = randomBytes(32);
      await writeFile(path, key, { flag: 'wx', mode: 0o600 });
    }
  }
  if (key.length !== 32)
    throw new Error(
      'INVOICE_SECRET must contain 32 base64-encoded random bytes.',
    );
  const database = await openDatabase({
    ...(settings.databaseUrl ? { url: settings.databaseUrl } : null),
    directory: resolve(directory, 'postgres'),
  });

  function vault<T>(
    namespace: string,
    lifetime: number,
    codec: Schema.ConstraintDecoder<unknown> & { readonly Type: T },
  ) {
    return {
      async set(id: string, value: T) {
        const name = `${namespace}:${id}`;
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        cipher.setAAD(Buffer.from(name));
        const bytes = Buffer.concat([
          cipher.update(JSON.stringify(value)),
          cipher.final(),
        ]);
        const payload = Buffer.concat([
          iv,
          cipher.getAuthTag(),
          bytes,
        ]).toString('base64');
        const expiresAt = new Date(Date.now() + lifetime).toISOString();
        await database.db
          .insert(secrets)
          .values({ key: name, payload, expiresAt })
          .onConflictDoUpdate({
            target: secrets.key,
            set: { payload, expiresAt },
          });
      },
      async get(id: string): Promise<T | undefined> {
        const name = `${namespace}:${id}`;
        const [row] = await database.db
          .select()
          .from(secrets)
          .where(eq(secrets.key, name));
        if (!row) return undefined;
        if (Date.parse(row.expiresAt) <= Date.now()) {
          await this.del(id);
          return undefined;
        }
        if (typeof row.payload !== 'string')
          throw new Error('Invalid encrypted session.');
        const bytes = Buffer.from(row.payload, 'base64');
        const decipher = createDecipheriv(
          'aes-256-gcm',
          key,
          bytes.subarray(0, 12),
        );
        decipher.setAAD(Buffer.from(name));
        decipher.setAuthTag(bytes.subarray(12, 28));
        const plaintext = Buffer.concat([
          decipher.update(bytes.subarray(28)),
          decipher.final(),
        ]);
        // GCM authenticates both the value and its namespace before this codec reads its own JSON.
        const parsed: unknown = JSON.parse(plaintext.toString('utf8'));
        try {
          return Schema.decodeUnknownSync(codec)(parsed);
        } catch {
          throw new Error('Invalid encrypted session.');
        }
      },
      async del(id: string) {
        await database.db
          .delete(secrets)
          .where(eq(secrets.key, `${namespace}:${id}`));
      },
    };
  }
  return { database, store: makeStore(database), vault };
}

declare global {
  var invoiceRuntime: ReturnType<typeof initialize> | undefined;
}

/** Keeps the local PostgreSQL process alive across development module reloads. */
export function runtime() {
  if (!globalThis.invoiceRuntime) {
    globalThis.invoiceRuntime = initialize().catch((error) => {
      globalThis.invoiceRuntime = undefined;
      throw error;
    });
  }
  return globalThis.invoiceRuntime;
}
