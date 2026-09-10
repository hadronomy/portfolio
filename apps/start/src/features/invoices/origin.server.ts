interface OriginSettings {
  readonly production: boolean;
  readonly configured?: string | undefined;
}

/** Resolves the public origin callers see, preferring explicit config over loopback request headers, and stays pure so tests pass requests directly. */
export function applicationOrigin(
  request: Request,
  settings: OriginSettings,
): string {
  if (settings.configured) {
    const configured = new URL(settings.configured);
    if (settings.production && configured.protocol !== 'https:')
      throw new Error('INVOICE_ORIGIN must use HTTPS in production.');
    return configured.origin;
  }
  if (settings.production) return 'https://hadronomy.com';
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
