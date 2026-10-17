import { Effect, Predicate, Schema } from 'effect';
import { StorageFailure } from '#model';

// The invoice modules speak of one database failure, StorageFailure: the
// database did not answer, or what it holds no longer reads as a record.
// Callers retry or report it; they never see Drizzle's or SQL's errors.

/** Drizzle's failed query and Effect SQL's broken connection or transaction, by tag. */
type Fault = { readonly _tag: 'EffectDrizzleQueryError' | 'SqlError' };

const isFault = (error: unknown): error is Fault =>
  Predicate.isTagged(error, 'EffectDrizzleQueryError') ||
  Predicate.isTagged(error, 'SqlError');

/** Reports every failed query or broken transaction in `self` as StorageFailure. Domain failures pass through. */
export const stored = <A, E, R>(
  self: Effect.Effect<A, E, R>,
): Effect.Effect<A, Exclude<E, Fault> | StorageFailure, R> =>
  self.pipe(
    Effect.mapError((error) =>
      isFault(error)
        ? new StorageFailure({ message: 'The database operation failed.' })
        : (error as Exclude<E, Fault>),
    ),
  );

/** Decodes a stored payload, reporting one that no longer fits its schema as StorageFailure. */
export const decodeStored =
  <S extends Schema.Codec<unknown, unknown>>(schema: S) =>
  (payload: unknown): Effect.Effect<S['Type'], StorageFailure> =>
    Schema.decodeUnknownEffect(schema)(payload).pipe(
      Effect.mapError(
        () => new StorageFailure({ message: 'A stored record is unreadable.' }),
      ),
    );
