import type { AuthContext } from '@better-auth/core';
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';

/** The get/set/del contract the AT Protocol OAuth client keeps its state and sessions behind. */
export interface Store<V> {
  get(key: string): Promise<V | undefined>;
  set(key: string, value: V): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * A store in better-auth's verification table, so it works on every adapter
 * and across serverless instances. Values hold DPoP private keys and tokens,
 * so they are encrypted with the auth secret before they reach the database.
 */
export function verificationStore<V>(
  context: Pick<AuthContext, 'internalAdapter' | 'secretConfig'>,
  namespace: string,
  lifetime: number,
): Store<V> {
  const identifier = (key: string) => `atproto:${namespace}:${key}`;
  const secret = context.secretConfig;
  return {
    async get(key) {
      const row = await context.internalAdapter.findVerificationValue(
        identifier(key),
      );
      if (!row || row.expiresAt.getTime() <= Date.now()) return undefined;
      const json = await symmetricDecrypt({ key: secret, data: row.value });
      return JSON.parse(json) as V;
    },
    async set(key, value) {
      const data = JSON.stringify(value);
      await context.internalAdapter.deleteVerificationByIdentifier(
        identifier(key),
      );
      await context.internalAdapter.createVerificationValue({
        identifier: identifier(key),
        value: await symmetricEncrypt({ key: secret, data }),
        expiresAt: new Date(Date.now() + lifetime),
      });
    },
    async del(key) {
      await context.internalAdapter.deleteVerificationByIdentifier(
        identifier(key),
      );
    },
  };
}
