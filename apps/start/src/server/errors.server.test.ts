import { Cause, Effect, Logger } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { errorDiagnostic, invoiceLogger, reportedError } from './errors.server';

describe('production error diagnostics', () => {
  it('keeps nested causes and SQL codes but excludes customer and query values', () => {
    const inner = Object.assign(
      new Error(
        'client@example.com secret-token\n    at private-customer-data',
      ),
      {
        code: '23505',
        query: 'insert values (private)',
      },
    );
    const outer = new Error('Invoice for Customer Name failed', {
      cause: inner,
    });
    const diagnostic = JSON.stringify(errorDiagnostic(Cause.die(outer)));
    expect(diagnostic).toContain('23505');
    expect(diagnostic).toContain('frames');
    for (const value of [
      'client@example.com',
      'secret-token',
      'Customer Name',
      'insert values',
      'private',
      'private-customer-data',
    ])
      expect(diagnostic).not.toContain(value);
  });
  it('redacts service logs and keeps the boundary request ID', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      Effect.runSync(
        Effect.logError(
          'Customer Name',
          Cause.die(new Error('client@example.com')),
        ).pipe(Effect.provide(Logger.layer([invoiceLogger('0123456789ab')]))),
      );
      const output = JSON.stringify(log.mock.calls);
      expect(output).toContain('0123456789ab');
      expect(output).toContain('Die');
      expect(output).not.toContain('Customer Name');
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
