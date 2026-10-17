import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { InvoiceDatabase } from '#database';
import { Preferences } from '#model';
import { decodeStored, stored } from '#storage';
import { records } from '#tables';

/** Public controller details, without bank details, tax settings, or customer records. */
export const privacyController = Effect.fn('Privacy.controller')(function* () {
  const db = yield* InvoiceDatabase;
  const [row] = yield* db
    .select({ payload: records.payload })
    .from(records)
    .where(eq(records.key, 'preferences'));
  if (!row) return null;
  const { issuer } = yield* decodeStored(Preferences)(row.payload);
  return {
    name: issuer.name,
    taxId: issuer.taxId,
    email: issuer.email,
    address: issuer.address,
  };
}, stored);

export type PrivacyController = Exclude<
  Effect.Success<ReturnType<typeof privacyController>>,
  null
>;
