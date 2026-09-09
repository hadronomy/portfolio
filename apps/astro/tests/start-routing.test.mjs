import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { after, before, test } from 'node:test';

let server;
let origin;
let output = '';
before(async () => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const { port } = socket.address();
  await new Promise((resolve) => socket.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: new URL('../', import.meta.url),
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
after(async () => {
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
    assert.equal(response.status, status);
    assert.equal(response.headers.has('x-portfolio-route-owner'), false);
    assert.ok((await response.text()).includes(text));
  });
}

test('Start scripts and styles load through the Astro server', async () => {
  const html = await (await fetch(`${origin}/experiments/text`)).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/_apps\/[^" ]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(assets.some((asset) => asset.endsWith('.js')));
  assert.ok(assets.some((asset) => asset.endsWith('.css')));
  for (const asset of assets) {
    const response = await fetch(origin + asset);
    assert.equal(response.status, 200, asset);
    assert.ok(
      !(response.headers.get('content-type') ?? '').includes('text/html'),
      asset,
    );
  }
});

test('HEAD keeps Start status and omits the response body', async () => {
  const response = await fetch(`${origin}/experiments/text`, {
    method: 'HEAD',
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});
