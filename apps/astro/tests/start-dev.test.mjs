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
import { pathToFileURL } from 'node:url';
import { dev } from 'astro';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { signIn } from './owner.mjs';

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
  expect(response.status).toBe(200);
  expect((await response.text()).includes('Count text locally')).toBeTruthy();
}

beforeAll(async () => {
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

afterAll(async () => {
  if (fixtureCreated) await unlink(parentRoute).catch(() => {});
  for (const file of fixtures) await unlink(file).catch(() => {});
  await server?.stop();
  await globalThis.invoiceRuntime?.dispose();
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
  const response = await fetch(
    `${origin}/invoices/auth/atproto/client-metadata.json`,
    { headers: { 'x-forwarded-host': 'attacker.example' } },
  );
  expect(response.status).toBe(200);
  const metadata = await response.json();
  expect(metadata.redirect_uris).toEqual([
    `${origin}/invoices/auth/atproto/callback`,
  ]);
});

test('invoice OAuth sends an invalid callback back to sign-in with a reason', async () => {
  const response = await fetch(
    `${origin}/invoices/auth/atproto/callback?state=invalid&code=invalid`,
    { redirect: 'manual' },
  );
  expect(response.status).toBe(302);
  const target = new URL(response.headers.get('location'), origin);
  expect(target.pathname).toBe('/invoices');
  expect(target.searchParams.get('error')).toBeTruthy();
});

test('invoice OAuth sets the session cookie and redirects after owner authentication', async () => {
  const { response, session, cookie, signOut } = await signIn(origin);
  expect(response.status).toBe(302);
  expect(new URL(response.headers.get('location'), origin).pathname).toBe(
    '/invoices',
  );
  expect(session).toMatch(/HttpOnly/i);
  expect(session).toMatch(/SameSite=Lax/i);
  // The grant only proves who signed in; it is revoked at once.
  expect(signOut).toHaveBeenCalled();
  const workspace = await fetch(`${origin}/invoices`, { headers: { cookie } });
  expect(workspace.status).toBe(200);
  expect(await workspace.text()).toMatch(/Invoice workspace/);
});

test('invoice OAuth refuses a different account without a browser session', async () => {
  const { response, session, signOut } = await signIn(
    origin,
    'did:plc:other-account',
  );
  expect(response.status).toBe(302);
  expect(
    new URL(response.headers.get('location'), origin).searchParams.get('error'),
  ).toBe('not_owner');
  expect(session).toBeUndefined();
  expect(signOut).toHaveBeenCalled();
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
    expect(
      (await readFile(routeTree, 'utf8')).includes('ExperimentsRoute'),
    ).toBeTruthy();
    await textTool();
  }, 'add parent');
  const clientTree = await fetch(`${origin}/_apps/src/routeTree.gen.ts`);
  expect(clientTree.status).toBe(200);
  await clientTree.text();
  await unlink(parentRoute);
  fixtureCreated = false;
  await eventually(async () => {
    const generated = await readFile(routeTree, 'utf8');
    expect(!generated.includes('ExperimentsRoute'), generated).toBeTruthy();
    await textTool();
  }, 'remove parent');
});

test('Start assets and HMR use the Astro origin while port 4322 is occupied', async () => {
  const response = await fetch(`${origin}/_apps/@vite/client`);
  expect(response.status).toBe(200);
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
    expect(JSON.parse(message.data).type).toBe('connected');
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
    expect(response.status).toBe(200);
    expect((await response.text()).includes('DX route probe')).toBeTruthy();
  }, 'add Start route');
  await rename(route, renamed);
  await eventually(async () => {
    const response = await fetch(`${origin}/experiments/dx-renamed`);
    expect(response.status).toBe(200);
    expect((await response.text()).includes('DX route probe')).toBeTruthy();
    expect((await fetch(`${origin}/experiments/dx-probe`)).status).toBe(404);
  }, 'rename Start route');
  await unlink(renamed);
  await eventually(async () => {
    const response = await fetch(`${origin}/experiments/dx-renamed`);
    expect(response.status).toBe(404);
    expect((await response.text()).includes('Go back')).toBeTruthy();
  }, 'remove Start route');
});

test('Astro route additions and removals update Start ownership', async () => {
  const route = new URL('src/pages/experiments/text/dx-probe.astro', root);
  fixtures.add(route);
  await mkdir(new URL('./', route), { recursive: true });
  await writeFile(route, '<h1>Astro route probe</h1>\n', { flag: 'wx' });
  await eventually(async () => {
    const exact = await fetch(`${origin}/experiments/text/dx-probe`);
    expect(exact.status).toBe(200);
    expect((await exact.text()).includes('Astro route probe')).toBeTruthy();
    const missing = await fetch(`${origin}/experiments/text/dx-probe/missing`);
    expect(missing.status).toBe(404);
    expect((await missing.text()).includes('Go back')).toBeTruthy();
  }, 'add Astro child');
  await unlink(route);
  await eventually(async () => {
    const response = await fetch(`${origin}/experiments/text/dx-probe`);
    expect(response.status).toBe(404);
    expect(
      (await response.text()).includes('This experiment has no page here'),
    ).toBeTruthy();
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
  expect(await complete, output).toBe(0);
  expect(failure, String(failure)).toBe(undefined);
  expect(requests > 1).toBeTruthy();
  await textTool();
});

test('Astro React islands render without invalid-hook warnings', async () => {
  const response = await fetch(`${origin}/missing`);
  expect(response.status).toBe(404);
  expect((await response.text()).includes('Go back')).toBeTruthy();
  expect(reactWarnings.length, reactWarnings.join('\n')).toBe(0);
});
