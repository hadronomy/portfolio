import { Context, Effect, FileSystem, Layer, Path, Redacted } from 'effect';
import { AppConfig } from '~/server/config.server';

// The key that signs sessions and seals sign-in state. Production sets it;
// development makes one the first time and keeps it beside its database, so
// a restart does not sign everyone out.

/** The server's signing key, as 32 base64-encoded bytes. */
export class AppSecret extends Context.Service<
  AppSecret,
  Redacted.Redacted<string>
>()('AppSecret') {}

const keyBytes = 32;

/** INVOICE_SECRET, or in development one generated once in the data directory. */
export const appSecretLayer = Layer.effect(
  AppSecret,
  Effect.gen(function* () {
    const settings = yield* AppConfig;
    const key = settings.secret
      ? Buffer.from(Redacted.value(settings.secret), 'base64')
      : yield* stored(settings.dataDirectory);
    if (key.length !== keyBytes)
      return yield* Effect.die(
        new Error(
          'INVOICE_SECRET must contain 32 base64-encoded random bytes.',
        ),
      );
    return Redacted.make(Buffer.from(key).toString('base64'));
  }),
);

/** The development key, written with owner-only permissions the first time. */
const stored = Effect.fn('AppSecret.stored')(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.resolve(directory, 'encryption.key');
  if (yield* fs.exists(file)) return yield* fs.readFile(file);
  yield* fs.makeDirectory(path.resolve(directory), {
    recursive: true,
    mode: 0o700,
  });
  const key = crypto.getRandomValues(new Uint8Array(keyBytes));
  // `wx` fails if another process wrote it first; that key wins.
  yield* fs
    .writeFile(file, key, { flag: 'wx', mode: 0o600 })
    .pipe(Effect.catchTag('PlatformError', () => Effect.void));
  return yield* fs.readFile(file);
}, Effect.orDie);
