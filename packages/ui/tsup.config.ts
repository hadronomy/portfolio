import { readFile, writeFile } from 'fs/promises';
import { fdir } from 'fdir';
import { defineConfig } from 'tsup';

type PackageJson = {
  name: string;
  exports: Record<string, { import: string; types: string } | string>;
  typesVersions: Record<'*', Record<string, string[]>>;
  files: string[];
  dependencies: Record<string, string>;
  pnpm: {
    overrides: Record<string, string>;
  };
};

const entryPatterns = ['./src/**/*.(ts|tsx)'];
const jsxEntries = new fdir()
  .withBasePath()
  .withDirs()
  .glob(...entryPatterns)
  .crawl('.')
  .sync();

export default defineConfig((options) => ({
  entry: entryPatterns,
  clean: !options.watch,
  dts: true,
  // Set minify to false until I find the reason behind the
  // undefined variable error
  minify: true,
  treeshake: true,
  splitting: true,
  outDir: 'dist',
  format: ['esm'],
  external: ['react'],
  async onSuccess() {
    const pkgJson = JSON.parse(
      await readFile('./package.json', {
        encoding: 'utf-8',
      }),
    ) as PackageJson;
    pkgJson.exports = {
      './package.json': './package.json',
      '.': {
        import: './dist/index.js',
        types: './dist/index.d.ts',
      },
    };
    jsxEntries.forEach((entry) => {
      const file = entry.replace('src/', '').replace('.tsx', '').replace('.ts', '');
      pkgJson.exports[`./${file}`] = {
        import: `./dist/${file}.js`,
        types: `./dist/${file}.d.ts`,
      };
      pkgJson.typesVersions['*'] = {
        ...pkgJson.typesVersions['*'],
        [file]: [`dist/${file}.d.ts`],
      };
    });
    await writeFile('./package.json', JSON.stringify(pkgJson, null, 2));
  },
}));
