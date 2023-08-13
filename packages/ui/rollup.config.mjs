/* eslint-disable @typescript-eslint/ban-ts-comment */
import { readFile } from 'fs/promises';
import * as url from 'url';
import typescript from '@rollup/plugin-typescript';
import { fdir } from 'fdir';
import { defineRollupSwcOption, swc } from 'rollup-plugin-swc3';
import swcPreserveDirectives from 'rollup-swc-preserve-directives';
// import ttypescript from 'ttypescript';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export const entryPatterns = ['./src/**/*.(ts|tsx)'];
export const jsxEntries = new fdir()
  .withBasePath()
  .withDirs()
  .glob(...entryPatterns)
  .crawl('.')
  .sync();

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const pkgJson = JSON.parse(
  await readFile('./package.json', {
    encoding: 'utf-8',
  }),
);

/** @type {import('rollup').RollupOptions} */
export default {
  input: jsxEntries,
  treeshake: true,
  external: [
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    ...Object.keys(pkgJson.dependencies),
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    ...Object.keys(pkgJson.devDependencies),
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    ...Object.keys(pkgJson.peerDependencies),
    'react/jsx-runtime',
    'next/link',
    'react-icons/fa',
  ],
  output: {
    dir: 'dist',
    preserveModules: true,
    preserveModulesRoot: './src',
    globals: {
      react: 'React',
    },
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.build.json' }),
    swc(
      defineRollupSwcOption({
        jsc: {
          baseUrl: __dirname,
          externalHelpers: true,
        },
      }),
    ),
    swcPreserveDirectives(),
  ],
};
