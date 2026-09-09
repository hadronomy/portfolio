# Add a utility or experiment

Start runs through the Astro application. Use Node 22.12 or newer and Bun for package installation.

From the repository root:

```sh
bun install --frozen-lockfile
bun run dev
```

Open the Astro URL printed by the command. Visit `/experiments/text` to use the example utility.

Astro starts both applications and selects an available private port for Start. Use the Astro URL for pages, assets, and hot reload.

To stop a foreground session, press Ctrl+C. If Astro runs in the background, use `bun run dev:stop`.

## Add a route

Create a file under `src/routes/`. For example, `src/routes/experiments/timer.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/experiments/timer')({
  component: () => <h1>Timer</h1>,
});
```

Astro development and production builds generate `src/routeTree.gen.ts` and `src/astro-routes.gen.json`. Do not edit these files manually.

Use TanStack `Link` for navigation between Start routes. Use a normal anchor for Astro pages. In Astro, add `data-astro-reload` to links into Start.

Add server functions under `src/lib/`, as shown in `fingerprint.ts`. Keep application routes outside `/_apps/`, which contains Start assets and server functions.

## Build and check

From the repository root:

```sh
bun run build
bun run --cwd apps/start check
bun run --cwd apps/start test
bun run --cwd packages/site-routing test
bun run --cwd apps/astro test:routing
bun run --cwd apps/astro test:dev
```

The HTTP tests require the Node build. To start that build:

```sh
cd apps/astro
HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs
```

For the Vercel output, run from `apps/astro`:

```sh
VERCEL=1 bun run build
```

This creates `.vercel/output`. It does not publish a deployment.

See [the routing decision](../../docs/research/astro-start.md) for ownership rules and source evidence.
