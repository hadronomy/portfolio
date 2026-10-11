interface OriginSettings {
  readonly production: boolean;
  readonly configured?: string | undefined;
}

/** The origin fixed by configuration: the configured one, or the production site. Undefined in development, where the request decides. */
export function fixedOrigin(settings: OriginSettings): string | undefined {
  if (settings.configured) {
    const configured = new URL(settings.configured);
    if (settings.production && configured.protocol !== 'https:')
      throw new Error('INVOICE_ORIGIN must use HTTPS in production.');
    return configured.origin;
  }
  if (settings.production) return 'https://hadronomy.com';
  return undefined;
}

/**
 * Where agents reach the workspace. A token is bound to one MCP URL, so the
 * origin must not follow the request: development uses Astro's default
 * address unless INVOICE_ORIGIN names another.
 */
export function agentOrigin(settings: OriginSettings): string {
  return fixedOrigin(settings) ?? 'http://127.0.0.1:4321';
}

/** Resolves the public origin callers see, preferring explicit config over loopback request headers, and stays pure so tests pass requests directly. */
export function applicationOrigin(
  request: Request,
  settings: OriginSettings,
): string {
  const fixed = fixedOrigin(settings);
  if (fixed) return fixed;
  // The development proxy overwrites this header with the public host on both request paths.
  const url = new URL(
    `http://${request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host}`,
  );
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Use a loopback address for local invoice development.');
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid local invoice host.');
  url.hostname = '127.0.0.1';
  return url.origin;
}
