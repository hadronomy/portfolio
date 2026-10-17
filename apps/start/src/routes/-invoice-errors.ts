import { createIsomorphicFn } from '@tanstack/react-start';
import { reportedError } from '~/server/errors.server';

/** Server errors carry this ID in a message that contains no private values. */
export const errorRequestId = (error: unknown) =>
  error instanceof Error
    ? /^Invoice request failed \(([a-f0-9]{12})\)\.$/.exec(error.message)?.[1]
    : undefined;

// A thrown replacement is what Router serializes. Keep the original cause
// on the server, including errors from loaders that do not call serve().
export const invoiceRouteError = createIsomorphicFn()
  .server((error: unknown) => {
    if (import.meta.env.PROD && !errorRequestId(error))
      throw reportedError(error);
  })
  .client((_error: unknown) => {});
