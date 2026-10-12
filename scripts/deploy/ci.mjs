import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const commands = [
  ['bun', ['biome', 'ci', '.']],
  ['bun', ['run', 'build']],
  ['bun', ['turbo', 'run', 'check', 'test', 'db:check']],
];
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
