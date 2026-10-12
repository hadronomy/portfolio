import { randomBytes } from 'node:crypto';
import { Cause, Logger } from 'effect';

export const newRequestId = () => randomBytes(6).toString('hex');

/** Keeps every cause and stack frame, without request values or error messages. */
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
  if (!(error instanceof Error)) return { type: typeof error };
  // SQL and provider messages can contain names, emails, tokens and query
  // parameters. Record the full cause chain by type, code and stack only.
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
