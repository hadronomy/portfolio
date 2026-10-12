import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const env = { ...process.env };
// Alchemy selects Bun from these variables even when its launcher runs on Node.
delete env.npm_execpath;
delete env.npm_config_user_agent;
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL('../node_modules/alchemy/bin/cli.js', import.meta.url),
    ),
    ...process.argv.slice(2),
    '--stage',
    'production',
  ],
  { env, stdio: 'inherit' },
);
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
