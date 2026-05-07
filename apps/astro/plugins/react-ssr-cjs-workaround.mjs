import { createRequire } from 'node:module';

/**
 * @fileoverview Redirects SSR React-family imports to virtual ESM shims backed
 * by Node's CommonJS loader.
 *
 * @remarks
 * Vite's SSR pipeline can occasionally evaluate React's CommonJS entrypoints as
 * transformed source rather than as external dependencies. When that happens,
 * CommonJS globals such as `module` are unavailable and the render crashes with
 * `module is not defined`.
 *
 * This plugin avoids source rewriting entirely. Instead, it intercepts SSR-only
 * imports for a small set of React-related package ids and replaces them with
 * virtual modules that:
 *
 * 1. Load the real CommonJS module via `createRequire(import.meta.url)`.
 * 2. Re-export its default export.
 * 3. Re-export stable named bindings from collision-safe local identifiers.
 *
 * The result behaves like a normal ESM module from Vite's perspective while
 * still loading React through Node's CommonJS interop path.
 */

/**
 * Runtime metadata used to generate a stable shim module for one package id.
 *
 * @typedef {object} ModuleMetadata
 * @property {string} resolvedId
 *   Fully resolved filesystem path for the CommonJS module entrypoint.
 * @property {string[]} exportNames
 *   Sorted list of valid JavaScript identifiers exposed by the module.
 */

/**
 * Optional configuration for {@link reactSsrCjsWorkaround}.
 *
 * @typedef {object} ReactSsrCjsWorkaroundOptions
 * @property {string} [namespace]
 *   Namespace used for the Vite plugin name and its virtual module prefix.
 */

/**
 * Default namespace used when the caller does not provide one explicitly.
 *
 * @type {string}
 */
const DEFAULT_NAMESPACE = 'react-ssr-cjs-workaround';

/**
 * Package ids that should be redirected to virtual shims during SSR.
 *
 * @type {string[]}
 */
const REACT_SSR_MODULES = [
  'react',
  'react-dom',
  'react-dom/server',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
];

/**
 * Constant-time lookup table for supported SSR shim targets.
 *
 * @type {Set<string>}
 */
const REACT_SSR_MODULE_SET = new Set(REACT_SSR_MODULES);

/**
 * Ensures that generated named exports are valid ESM identifiers.
 *
 * @type {RegExp}
 */
const VALID_IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;

/**
 * CommonJS resolver/loader anchored to this module.
 *
 * @type {NodeJS.Require}
 */
const nodeRequire = createRequire(import.meta.url);

/**
 * Caches per-package metadata so repeated resolves in dev do not keep reading
 * the same CommonJS module shape.
 *
 * @type {Map<string, ModuleMetadata>}
 */
const moduleMetadataCache = new Map();

/**
 * Caches generated shim source keyed by package id.
 *
 * @type {Map<string, string>}
 */
const shimCodeCache = new Map();

/**
 * Checks whether the current Vite hook invocation targets an SSR environment.
 *
 * @param {{ ssr?: boolean } | undefined} options
 *   Vite hook options bag.
 * @returns {boolean}
 *   `true` when the hook is running for SSR or prerender work.
 */
function isSsrRequest(options) {
  return Boolean(options?.ssr);
}

/**
 * Builds the virtual module prefix for a given plugin namespace.
 *
 * @param {string} namespace
 *   Namespace selected for this plugin instance.
 * @returns {string}
 *   A `\0`-prefixed virtual module namespace understood by Vite.
 */
function getVirtualPrefix(namespace) {
  return `\0${namespace}:`;
}

/**
 * Builds the full virtual id for one redirected package import.
 *
 * @param {string} namespace
 *   Namespace selected for this plugin instance.
 * @param {string} source
 *   Original package id requested by the importing module.
 * @returns {string}
 *   Virtual module id used by Vite to resolve the shim.
 */
function getVirtualId(namespace, source) {
  return `${getVirtualPrefix(namespace)}${source}`;
}

/**
 * Resolves and inspects one CommonJS module so its shim can be generated once
 * and reused safely.
 *
 * @param {string} source
 *   Original package id requested by the importing module.
 * @returns {ModuleMetadata}
 *   Resolved module path plus the stable list of named exports to expose.
 */
function getModuleMetadata(source) {
  let metadata = moduleMetadataCache.get(source);
  if (!metadata) {
    const resolvedId = nodeRequire.resolve(source);
    const exports = nodeRequire(source);
    const exportNames = Object.getOwnPropertyNames(exports)
      .filter(
        (name) => name !== 'default' && VALID_IDENTIFIER_PATTERN.test(name),
      )
      .sort();

    metadata = { resolvedId, exportNames };
    moduleMetadataCache.set(source, metadata);
  }

  return metadata;
}

/**
 * Generates virtual ESM source for one CommonJS React-family package.
 *
 * @param {string} source
 *   Original package id requested by the importing module.
 * @returns {string}
 *   ESM shim source that loads the real CommonJS entrypoint through
 *   `createRequire(import.meta.url)` and re-exports its public bindings.
 */
function buildShimCode(source) {
  const { resolvedId, exportNames } = getModuleMetadata(source);
  const bindingLines = exportNames.map(
    (name, index) =>
      `const __react_ssr_export_${index} = __react_ssr_module[${JSON.stringify(name)}];`,
  );
  const exportSpecifiers = exportNames.map(
    (name, index) => `__react_ssr_export_${index} as ${name}`,
  );

  return [
    'import { createRequire as __react_ssr_createRequire } from "node:module";',
    `const __react_ssr_require = __react_ssr_createRequire(${JSON.stringify(import.meta.url)});`,
    `const __react_ssr_module = __react_ssr_require(${JSON.stringify(resolvedId)});`,
    ...bindingLines,
    'export default __react_ssr_module;',
    exportSpecifiers.length ? `export { ${exportSpecifiers.join(', ')} };` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Returns cached shim source for one package id, generating it on first use.
 *
 * @param {string} source
 *   Original package id requested by the importing module.
 * @returns {string}
 *   Cached virtual module source.
 */
function getShimCode(source) {
  let shimCode = shimCodeCache.get(source);
  if (!shimCode) {
    shimCode = buildShimCode(source);
    shimCodeCache.set(source, shimCode);
  }

  return shimCode;
}

/**
 * Creates a Vite plugin that replaces SSR-only React-family imports with
 * virtual ESM shims backed by Node's CommonJS loader.
 *
 * @param {ReactSsrCjsWorkaroundOptions} [options]
 *   Optional plugin configuration.
 * @returns {import('vite').Plugin}
 *   A Vite plugin suitable for `vite.plugins`.
 */
export function reactSsrCjsWorkaround({ namespace = DEFAULT_NAMESPACE } = {}) {
  const virtualPrefix = getVirtualPrefix(namespace);

  return {
    name: namespace,
    enforce: 'pre',
    resolveId(source, _importer, options) {
      if (!isSsrRequest(options) || !REACT_SSR_MODULE_SET.has(source)) {
        return null;
      }

      return getVirtualId(namespace, source);
    },
    load(id) {
      if (!id.startsWith(virtualPrefix)) {
        return null;
      }

      const source = id.slice(virtualPrefix.length);
      return getShimCode(source);
    },
  };
}
