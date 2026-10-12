import { Cause, Effect, Logger } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import {
  errorDiagnostic,
  invoiceLogger,
  reportedError,
  scrubbed,
} from './errors.server';

describe('production error diagnostics', () => {
  it('keeps messages, causes and SQL codes but scrubs customer and query values', () => {
    const inner = Object.assign(
      new Error(
        'Failed query: insert into "customers" values ($1, $2)\nparams: Ana Pérez,client@example.com',
      ),
      { code: '23505' },
    );
    const outer = new Error(
      'duplicate key value violates unique constraint "customers_email_key": Key (email)=(client@example.com)',
      { cause: inner },
    );
    const diagnostic = JSON.stringify(errorDiagnostic(Cause.die(outer)));
    expect(diagnostic).toContain('23505');
    expect(diagnostic).toContain('frames');
    expect(diagnostic).toContain('violates unique constraint');
    expect(diagnostic).toContain('Failed query: insert into');
    for (const value of ['client@example.com', 'Ana Pérez', 'params'])
      expect(diagnostic).not.toContain(value);
  });
  it('scrubs addresses, credentials, tokens and long numbers', () => {
    expect(
      scrubbed(
        'postgres://user:pa55@db.example.com/x mail ana@x.es token aXM3QR6AC22SHjBLTlpEZMPQ33NXNr7j IBAN ES00 0000 0000 0000',
      ),
    ).toBe(
      'postgres://<credentials>@db.example.com/x mail <email> token <token> IBAN ES<number>',
    );
  });
  it('keeps service log lines readable and scrubbed, with the request ID', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      Effect.runSync(
        Effect.logError(
          'Quote confirmation not sent',
          Cause.die(new Error('Resend refused client@example.com')),
        ).pipe(Effect.provide(Logger.layer([invoiceLogger('0123456789ab')]))),
      );
      const output = JSON.stringify(log.mock.calls);
      expect(output).toContain('0123456789ab');
      expect(output).toContain('Die');
      expect(output).toContain('Quote confirmation not sent');
      expect(output).toContain('Resend refused');
      expect(output).not.toContain('client@example.com');
    } finally {
      log.mockRestore();
    }
  });
  it('returns only the request ID and a generic error to Start', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = reportedError(new Error('private'), '0123456789ab');
      expect(result.message).toBe('Invoice request failed (0123456789ab).');
      expect(result.cause).toBeUndefined();
      expect(log).toHaveBeenCalledWith(
        'Invoice request failed',
        expect.stringContaining('0123456789ab'),
      );
    } finally {
      log.mockRestore();
    }
  });
});
