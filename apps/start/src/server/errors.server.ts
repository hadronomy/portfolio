import { randomBytes } from 'node:crypto';
import { Cause, Logger } from 'effect';

export const newRequestId = () => randomBytes(6).toString('hex');

/**
 * The text of an error or log line, with what could identify a person or
 * open an account taken out. The message is what makes a log line worth
 * reading, so it stays; the values inside it go.
 */
export const scrubbed = (text: string) =>
  text
    // Drizzle appends the query's parameters on their own line: customer data.
    .replace(/\n\s*params:[\s\S]*$/, '')
    // Postgres details name the offending value: Key (email)=(a@b.c).
    .replace(/=\([^)]*\)/g, '=(…)')
    // Before addresses, which would otherwise swallow user:password@host.
    .replace(/:\/\/[^\s/@]+@/g, '://<credentials>@')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '<token>')
    .replace(/\d[\d\s-]{6,}\d/g, '<number>');

/** Keeps every cause, stack frame and scrubbed message, without request values. */
export function errorDiagnostic(
  error: unknown,
  seen = new Set<unknown>(),
): unknown {
  if (seen.has(error)) return { type: 'CircularCause' };
  seen.add(error);
  if (Array.isArray(error))
    return error.map((item) => errorDiagnostic(item, seen));
  if (Cause.isCause(error))
    return error.reasons.map((reason) => {
      if (Cause.isFailReason(reason) || Cause.isDieReason(reason))
        return {
          type: reason._tag,
          cause: errorDiagnostic(
            Cause.isDieReason(reason) ? reason.defect : reason.error,
            seen,
          ),
        };
      return { type: 'Interrupt' };
    });
  if (typeof error === 'string') return scrubbed(error);
  if (!(error instanceof Error)) return { type: typeof error };
  const code =
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_]{1,40}$/.test(error.code)
      ? error.code
      : undefined;
  const frames = error.stack
    ?.split('\n')
    .slice(error.message.split('\n').length)
    .filter((line) => /^\s+at /.test(line))
    .map((line) => line.replace(/\?[^\s)]*/g, ''));
  return {
    type: error.constructor.name,
    message: scrubbed(error.message),
    code,
    frames,
    ...('cause' in error ? { cause: errorDiagnostic(error.cause, seen) } : {}),
    ...(error instanceof AggregateError
      ? {
          causes: error.errors.map((cause: unknown) =>
            errorDiagnostic(cause, seen),
          ),
        }
      : {}),
  };
}

/** The only production error sent across the server-function boundary. */
export function reportedError(
  error: unknown,
  requestId = newRequestId(),
): Error {
  console.error(
    'Invoice request failed',
    JSON.stringify({
      requestId,
      cause: errorDiagnostic(error),
    }),
  );
  return new Error(`Invoice request failed (${requestId}).`);
}

// Service logs can contain whole provider causes. Replace the default Effect
// logger at the request boundary so these logs obey the same privacy rule.
export const invoiceLogger = (requestId: string) =>
  Logger.make<unknown, void>((event) => {
    console.error(
      'Invoice server log',
      JSON.stringify({
        requestId,
        level: event.logLevel,
        cause: errorDiagnostic([event.message, event.cause]),
      }),
    );
  });
