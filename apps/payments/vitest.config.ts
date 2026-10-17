import { packageTests } from '@portfolio/vitest-config';

// Tests reach the Worker's modules through the `~/` path in tsconfig.json.
export default packageTests(import.meta.dirname, {
  resolve: { tsconfigPaths: true },
});
