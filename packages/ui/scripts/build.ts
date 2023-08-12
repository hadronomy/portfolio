import { writeFile } from 'fs/promises';
import { rollup } from 'rollup';

import rollupConfig, { jsxEntries, pkgJson } from '../rollup.config.mjs';

async function main() {
  async function build() {
    const bundle = await rollup(rollupConfig);
    return Promise.allSettled([
      bundle.write({
        dir: 'dist',
        preserveModules: true,
        preserveModulesRoot: './src',
        globals: {
          react: 'React',
        },
      }),
    ]);
  }

  async function exports() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    pkgJson.exports = {
      './package.json': './package.json',
      '.': {
        import: './dist/index.js',
        types: './dist/index.d.ts',
      },
    };
    jsxEntries.forEach((entry) => {
      const file = entry
        .replace('src/', '')
        .replace('.tsx', '')
        .replace('.ts', '');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      pkgJson.exports[`./${file}`] = {
        import: `./dist/${file}.js`,
        types: `./dist/${file}.d.ts`,
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      pkgJson.typesVersions['*'] = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ...pkgJson.typesVersions['*'],
        [file]: [`dist/${file}.d.ts`],
      };
    });
    await writeFile('./package.json', JSON.stringify(pkgJson, null, 2));
  }

  return Promise.allSettled([build(), exports()]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
