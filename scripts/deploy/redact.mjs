export function redactDatabase(value, env) {
  const secrets = new Set();
  for (const url of [env.DATABASE_URL, env.DATABASE_URL_UNPOOLED]) {
    if (!url) continue;
    secrets.add(url);
    try {
      const parsed = new URL(url);
      secrets.add(parsed.href);
      if (parsed.password) {
        secrets.add(parsed.password);
        secrets.add(decodeURIComponent(parsed.password));
      }
    } catch {
      // Invalid connection strings can appear in URL parser errors.
    }
  }
  let result = String(value).replace(
    /postgres(?:ql)?:\/\/[^\s'"<>]+/gi,
    '[REDACTED_DATABASE_URL]',
  );
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    result = result.replaceAll(secret, '[REDACTED]');
  }
  return result;
}
