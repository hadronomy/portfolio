import { expect, test } from 'vitest';
import { step } from './step';

test('waits while the browser follows the provider', () => {
  expect(
    step({
      data: { redirect: true, url: 'http://localhost:9/callback?code=c' },
      error: null,
    }),
  ).toEqual({ kind: 'leaving' });
});

test('says a request expired only when it did', () => {
  const expired = 'This request has expired. Start again from your agent.';
  for (const error of [
    { error: 'invalid_signature' },
    { error: 'invalid_request', error_description: 'missing oauth query' },
  ])
    expect(step({ data: null, error })).toEqual({
      kind: 'stopped',
      problem: expired,
    });
  expect(
    step({
      data: null,
      error: { error: 'invalid_client', error_description: 'client disabled' },
    }),
  ).toEqual({ kind: 'stopped', problem: 'client disabled' });
});

test('an answer that is neither is a failure, never a silent wait', () => {
  expect(step({ data: { redirect_uri: 'x' }, error: null }).kind).toBe(
    'stopped',
  );
});
