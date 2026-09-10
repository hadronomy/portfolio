import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dev } from 'astro';

const root = new URL('../', import.meta.url);
const parentRoute = new URL('../start/src/routes/experiments.tsx', root);
const routeTree = new URL('../start/src/routeTree.gen.ts', root);
let server;
let invoiceData;
const invoiceEnvironment = Object.fromEntries(
  ['INVOICE_DATA_DIRECTORY', 'DATABASE_URL', 'INVOICE_SECRET'].map((key) => [
    key,
    process.env[key],
  ]),
);
let origin;
let fixtureCreated = false;
let portBlocker;
const fixtures = new Set();
const reactWarnings = [];
const originalConsoleError = console.error;
console.error = (...args) => {
  if (String(args[0]).startsWith('Invalid hook call')) {
    reactWarnings.push(String(args[0]));
  }
  originalConsoleError(...args);
};

async function eventually(check, label) {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      return await check();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label}: ${lastError}`, { cause: lastError });
}

async function textTool() {
  const response = await fetch(`${origin}/experiments/text`);
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('Count text locally'));
}

before(async () => {
  invoiceData = await mkdtemp(join(tmpdir(), 'portfolio-auth-test-'));
  process.env.INVOICE_DATA_DIRECTORY = invoiceData;
  delete process.env.DATABASE_URL;
  delete process.env.INVOICE_SECRET;
  portBlocker = createServer();
  await new Promise((resolve, reject) => {
    portBlocker.once('error', (error) =>
      error.code === 'EADDRINUSE' ? resolve() : reject(error),
    );
    portBlocker.listen(4322, '127.0.0.1', resolve);
  });
  server = await dev({
    root,
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  });
  origin = `http://127.0.0.1:${server.address.port}`;
});

after(async () => {
  if (fixtureCreated) await unlink(parentRoute).catch(() => {});
  for (const file of fixtures) await unlink(file).catch(() => {});
  await server?.stop();
  if (globalThis.invoiceRuntime)
    await (await globalThis.invoiceRuntime).database.close();
  delete globalThis.invoiceRuntime;
  if (invoiceData) await rm(invoiceData, { recursive: true, force: true });
  for (const [key, value] of Object.entries(invoiceEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  console.error = originalConsoleError;
  if (portBlocker?.listening)
    await new Promise((resolve) => portBlocker.close(resolve));
});

test('invoice OAuth metadata uses the public origin through the development proxy', async () => {
  const response = await fetch(`${origin}/invoices/auth/client-metadata.json`, {
    headers: { 'x-forwarded-host': 'attacker.example' },
  });
  assert.equal(response.status, 200);
  const metadata = await response.json();
  assert.deepEqual(metadata.redirect_uris, [
    `${origin}/invoices/auth/callback`,
  ]);
});

test('invoice OAuth rejects an invalid callback with a readable response', async () => {
  const response = await fetch(
    `${origin}/invoices/auth/callback?state=invalid&iss=https%3A%2F%2Fbsky.social&code=invalid`,
    {
      headers: { cookie: 'invoice-login=invalid' },
    },
  );
  assert.equal(response.status, 400);
  assert.match(await response.text(), /Start again/);
});

test('invoice OAuth sets the session cookie and redirects after owner authentication', async (t) => {
  const requireStart = createRequire(
    new URL('../../start/package.json', import.meta.url),
  );
  const { NodeOAuthClient } = await import(
    pathToFileURL(requireStart.resolve('@atproto/oauth-client-node')).href
  );
  t.mock.method(NodeOAuthClient.prototype, 'callback', async () => ({
    session: { did: 'did:plc:tvgjv46t4ebxbrvekr2vrnls' },
    state: 'test-browser-nonce',
  }));
  const response = await fetch(`${origin}/invoices/auth/callback?state=test`, {
    headers: { cookie: 'invoice-login=test-browser-nonce' },
    redirect: 'manual',
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), `${origin}/invoices`);
  const cookies = response.headers.getSetCookie();
  assert.ok(
    cookies.some(
      (cookie) =>
        cookie.startsWith('invoice-login=') && /Max-Age=0/i.test(cookie),
    ),
  );
  const session = cookies.find((cookie) =>
    cookie.startsWith('invoice-session='),
  );
  assert.ok(session);
  assert.match(session, /HttpOnly/i);
  assert.match(session, /SameSite=Lax/i);
  const workspace = await fetch(`${origin}/invoices`, {
    headers: { cookie: session.split(';')[0] },
  });
  assert.equal(workspace.status, 200);
  assert.match(await workspace.text(), /Invoice workspace/);
});

test('invoice OAuth refuses a different account without a browser session', async (t) => {
  const requireStart = createRequire(
    new URL('../../start/package.json', import.meta.url),
  );
  const { NodeOAuthClient } = await import(
    pathToFileURL(requireStart.resolve('@atproto/oauth-client-node')).href
  );
  const otherDid = 'did:plc:other-account';
  t.mock.method(NodeOAuthClient.prototype, 'callback', async () => ({
    session: { did: otherDid },
    state: 'test-browser-nonce',
  }));
  const revoke = t.mock.method(
    NodeOAuthClient.prototype,
    'revoke',
    async () => {},
  );
  const response = await fetch(`${origin}/invoices/auth/callback?state=test`, {
    headers: { cookie: 'invoice-login=test-browser-nonce' },
    redirect: 'manual',
  });
  assert.equal(response.status, 403);
  assert.match(await response.text(), /belongs to hadronomy.com/);
  assert.equal(
    response.headers
      .getSetCookie()
      .some((cookie) => cookie.startsWith('invoice-session=')),
    false,
  );
  assert.equal(revoke.mock.calls[0].arguments[0], otherDid);
});

test('removing a Start parent keeps its child route working without a restart', async () => {
  await textTool();
  await writeFile(
    parentRoute,
    `import { createFileRoute, Outlet } from '@tanstack/react-router';\nexport const Route = createFileRoute('/experiments')({ component: Outlet });\n`,
    { flag: 'wx' },
  );
  fixtureCreated = true;
  await eventually(async () => {
    assert.ok((await readFile(routeTree, 'utf8')).includes('ExperimentsRoute'));
    await textTool();
  }, 'add parent');
  const clientTree = await fetch(`${origin}/_apps/src/routeTree.gen.ts`);
  assert.equal(clientTree.status, 200);
  await clientTree.text();
  await unlink(parentRoute);
  fixtureCreated = false;
  await eventually(async () => {
    const generated = await readFile(routeTree, 'utf8');
    assert.ok(!generated.includes('ExperimentsRoute'), generated);
    await textTool();
  }, 'remove parent');
});

test('Start assets and HMR use the Astro origin while port 4322 is occupied', async () => {
  const response = await fetch(`${origin}/_apps/@vite/client`);
  assert.equal(response.status, 200);
  const source = await response.text();
  const token = JSON.parse(source.match(/const wsToken = ("[^"\n]+");/)[1]);
  const socket = new WebSocket(
    `${origin.replace('http:', 'ws:')}/_apps/?token=${token}`,
    'vite-hmr',
  );
  try {
    const [message] = await once(socket, 'message', {
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(JSON.parse(message.data).type, 'connected');
  } finally {
    socket.close();
  }
});

test('Start route additions, renames, and removals update without a restart', async () => {
  const route = new URL('../start/src/routes/experiments/dx-probe.tsx', root);
  const renamed = new URL(
    '../start/src/routes/experiments/dx-renamed.tsx',
    root,
  );
  fixtures.add(route);
  fixtures.add(renamed);
  await writeFile(
    route,
    `import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/experiments/dx-probe')({ component: () => <h1>DX route probe</h1> });\n`,
    { flag: 'wx' },
  );
  await eventually(async () => {
    const response = await fetch(`${origin}/experiments/dx-probe`);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('DX route probe'));
  }, 'add Start route');
  await rename(route, renamed);
  await eventually(async () => {
    const response = await fetch(`${origin}/experiments/dx-renamed`);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('DX route probe'));
    assert.equal((await fetch(`${origin}/experiments/dx-probe`)).status, 404);
  }, 'rename Start route');
  await unlink(renamed);
  await eventually(async () => {
    const response = await fetch(`${origin}/experiments/dx-renamed`);
    assert.equal(response.status, 404);
    assert.ok((await response.text()).includes('Go back'));
  }, 'remove Start route');
});

test('Astro route additions and removals update Start ownership', async () => {
  const route = new URL('src/pages/experiments/text/dx-probe.astro', root);
  fixtures.add(route);
  await mkdir(new URL('./', route), { recursive: true });
  await writeFile(route, '<h1>Astro route probe</h1>\n', { flag: 'wx' });
  await eventually(async () => {
    const exact = await fetch(`${origin}/experiments/text/dx-probe`);
    assert.equal(exact.status, 200);
    assert.ok((await exact.text()).includes('Astro route probe'));
    const missing = await fetch(`${origin}/experiments/text/dx-probe/missing`);
    assert.equal(missing.status, 404);
    assert.ok((await missing.text()).includes('Go back'));
  }, 'add Astro child');
  await unlink(route);
  await eventually(async () => {
    const response = await fetch(`${origin}/experiments/text/dx-probe`);
    assert.equal(response.status, 404);
    assert.ok(
      (await response.text()).includes('This experiment has no page here'),
    );
  }, 'remove Astro child');
});

test('a production build keeps the dev server available', async () => {
  let output = '';
  let finished = false;
  const child = spawn(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build'],
    {
      cwd: root,
      env: { ...process.env, VERCEL: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const complete = once(child, 'exit').then(([code]) => {
    finished = true;
    return code;
  });
  let requests = 0;
  let failure;
  while (!finished) {
    try {
      await textTool();
      requests++;
    } catch (error) {
      failure ??= error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(await complete, 0, output);
  assert.equal(failure, undefined, String(failure));
  assert.ok(requests > 1);
  await textTool();
});

test('Astro React islands render without invalid-hook warnings', async () => {
  const response = await fetch(`${origin}/missing`);
  assert.equal(response.status, 404);
  assert.ok((await response.text()).includes('Go back'));
  assert.equal(reactWarnings.length, 0, reactWarnings.join('\n'));
});
