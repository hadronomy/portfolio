import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';

let server;
let origin;
let output = '';
beforeAll(async () => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const { port } = socket.address();
  await new Promise((resolve) => socket.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => {
    output += chunk;
  });
  server.stderr.on('data', (chunk) => {
    output += chunk;
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      await fetch(`${origin}/robots.txt`);
      return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Server did not start: ${output}`);
});
afterAll(async () => {
  if (server?.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
});

for (const [path, status, text] of [
  ['/', 200, 'Pablo'],
  ['/experiments', 200, 'Small tools and things I want to try'],
  ['/experiments/text', 200, 'Count text locally'],
  ['/experiments/text/?from=test', 200, 'Count text locally'],
  ['/experiments/missing', 404, 'Go back'],
  ['/experiments/text/missing', 404, 'This experiment has no page here'],
  ['/experiments/text/missing/deep', 404, 'This experiment has no page here'],
  ['/blog/missing', 404, 'Go back'],
  ['/work/stacks/project/missing', 404, 'Go back'],
  ['/missing', 404, 'Go back'],
]) {
  test(`${path} returns ${status} from the correct framework`, async () => {
    const response = await fetch(origin + path);
    expect(response.status).toBe(status);
    expect(response.headers.has('x-portfolio-route-owner')).toBe(false);
    expect((await response.text()).includes(text)).toBeTruthy();
  });
}

test('Start scripts and styles load through the Astro server', async () => {
  const html = await (await fetch(`${origin}/experiments/text`)).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/_apps\/[^" ]+)"/g)].map(
    (match) => match[1],
  );
  expect(assets.some((asset) => asset.endsWith('.js'))).toBeTruthy();
  expect(assets.some((asset) => asset.endsWith('.css'))).toBeTruthy();
  for (const asset of assets) {
    const response = await fetch(origin + asset);
    expect(response.status, asset).toBe(200);
    expect(
      !(response.headers.get('content-type') ?? '').includes('text/html'),
      asset,
    ).toBeTruthy();
  }
});

test('HEAD keeps Start status and omits the response body', async () => {
  const response = await fetch(`${origin}/experiments/text`, {
    method: 'HEAD',
  });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('');
});

// Stripe's fields load this file from their own origin; vercel.json grants
// that cross-origin read on the deployed site.
test('the site serves the self-hosted Geist font and its licence', async () => {
  const response = await fetch(`${origin}/fonts/geist-latin-wght-normal.woff2`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('font/woff2');
  const font = Buffer.from(await response.arrayBuffer());
  expect(font.subarray(0, 4).toString()).toBe('wOF2');
  expect(font.length).toBeGreaterThan(10_000);
  const licence = await fetch(`${origin}/fonts/OFL.txt`);
  expect(licence.status).toBe(200);
  expect(await licence.text()).toContain('SIL OPEN FONT LICENSE');
});
