import {
  buildAtprotoLoopbackClientMetadata,
  JoseKey,
  NodeOAuthClient,
  type NodeSavedSession,
  type NodeSavedState,
  requestLocalLock,
} from '@atproto/oauth-client-node';
import type { AuthContext } from '@better-auth/core';
import { APIError } from 'better-auth/api';
import { ATPROTO_ERROR_CODES } from '#error-codes';
import { verificationStore } from '#store';

/** Paths the plugin serves under the auth base path. */
export const paths = {
  callback: '/atproto/callback',
  metadata: '/atproto/client-metadata.json',
  jwks: '/atproto/jwks.json',
} as const;

/** Identity is all the plugin asks for; `atproto` is the scope that grants just that. */
export const scope = 'atproto';

export interface ClientSettings {
  readonly clientName: string;
  readonly keys: readonly string[];
}

// The flow lives ten minutes, and the session only as long as the callback
// that reads the identity and revokes it.
const flowLifetime = 10 * 60_000;

/**
 * Builds the OAuth client for the base URL a request resolved to. Loopback
 * development runs as a public client, which the protocol allows without
 * keys; any other origin is a confidential client that signs its token
 * requests, and must be HTTPS.
 */
export async function createOAuthClient(
  context: AuthContext,
  settings: ClientSettings,
) {
  const base = context.baseURL;
  const url = new URL(base);
  const stores = {
    stateStore: verificationStore<NodeSavedState>(
      context,
      'state',
      flowLifetime,
    ),
    sessionStore: verificationStore<NodeSavedSession>(
      context,
      'session',
      flowLifetime,
    ),
    // Sessions are revoked inside the callback that creates them, so no
    // refresh ever runs twice and a process-local lock is enough.
    requestLock: requestLocalLock,
  };
  const redirect = `${base}${paths.callback}`;
  if (url.protocol === 'http:') {
    // The protocol forbids `localhost` in loopback redirect URIs, and the
    // state cookie set on localhost never reaches 127.0.0.1.
    if (url.hostname === 'localhost')
      throw APIError.from(
        'BAD_REQUEST',
        ATPROTO_ERROR_CODES.LOOPBACK_HOST_REQUIRED,
      );
    if (url.hostname !== '127.0.0.1' && url.hostname !== '[::1]')
      throw APIError.from('BAD_REQUEST', ATPROTO_ERROR_CODES.HTTPS_REQUIRED);
    return new NodeOAuthClient({
      clientMetadata: buildAtprotoLoopbackClientMetadata({
        scope,
        redirect_uris: [redirect as `http://127.0.0.1${string}`],
      }),
      ...stores,
    });
  }
  if (settings.keys.length === 0)
    throw APIError.from(
      'INTERNAL_SERVER_ERROR',
      ATPROTO_ERROR_CODES.SIGNING_KEYS_MISSING,
    );
  const keyset = await Promise.all(
    settings.keys.map((jwk) => JoseKey.fromJWK(jwk)),
  );
  return new NodeOAuthClient({
    clientMetadata: {
      client_id: `${base}${paths.metadata}`,
      client_name: settings.clientName,
      client_uri: url.origin as `https://${string}`,
      redirect_uris: [redirect as `https://${string}`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope,
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: 'ES256',
      application_type: 'web',
      dpop_bound_access_tokens: true,
      jwks_uri: `${base}${paths.jwks}`,
    },
    keyset,
    ...stores,
  });
}
