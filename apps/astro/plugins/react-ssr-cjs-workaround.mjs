import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Vite SSR can evaluate React's CommonJS entry as transformed source instead of
// externalizing it. That reproduces under Bun and Node package-manager installs,
// so keep this workaround scoped to SSR transforms rather than Bun-specific code.
const ASTRO_REACT_RENDERER_FILES = [
  '/@astrojs/react/dist/server.js',
  '/@astrojs/react/dist/server-v17.js',
];

const ASTRO_REACT_HELPER_FILES = [
  '/@astrojs/react/dist/static-html.js',
  '/@astrojs/react/dist/vnode-children.js',
];

const WORKSPACE_SSR_REACT_ROOTS = ['/apps/astro/src/', '/packages/ui/src/'];

const SSR_REACT_EXTERNALS = new Set([
  'react',
  'react-dom',
  'react-dom/server',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]);

const SSR_REACT_REQUIRE_PREAMBLE = [
  'import { createRequire as __astroReactCreateRequire } from "node:module";',
  'const __astroReactRequire = __astroReactCreateRequire(import.meta.url);',
].join('\n');

const DIRECTIVE_PROLOGUE_PATTERN = /^(?:\s*['"][^'"]+['"];\s*)*/;
const nodeRequire = createRequire(import.meta.url);

function matchesAny(id, suffixes) {
  return suffixes.some((suffix) => id.includes(suffix));
}

function injectReactRequirePreamble(code) {
  if (code.includes('__astroReactCreateRequire')) {
    return code;
  }

  const directives = code.match(DIRECTIVE_PROLOGUE_PATTERN)?.[0] ?? '';
  return `${directives}${SSR_REACT_REQUIRE_PREAMBLE}\n${code.slice(
    directives.length,
  )}`;
}

function replaceImportBlock(code, importBlock, replacementLines) {
  if (!code.includes(importBlock)) {
    return null;
  }

  return code.replace(importBlock, replacementLines.join('\n'));
}

function normalizeSpecifier(specifier) {
  return specifier.replace(/\s+/g, ' ').trim();
}

function toDestructuringSpecifier(specifier) {
  const cleaned = normalizeSpecifier(specifier).replace(/^type\s+/, '');
  if (!cleaned) {
    return null;
  }

  const aliasMatch = cleaned.match(
    /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/,
  );
  if (aliasMatch) {
    return `${aliasMatch[1]}: ${aliasMatch[2]}`;
  }

  return cleaned;
}

function splitNamedSpecifiers(rawSpecifiers) {
  return rawSpecifiers.split(',').map(normalizeSpecifier).filter(Boolean);
}

function partitionNamedSpecifiers(rawSpecifiers) {
  const runtimeSpecifiers = [];
  const typeSpecifiers = [];

  for (const specifier of splitNamedSpecifiers(rawSpecifiers)) {
    if (specifier.startsWith('type ')) {
      typeSpecifiers.push(specifier.replace(/^type\s+/, ''));
      continue;
    }

    const runtimeSpecifier = toDestructuringSpecifier(specifier);
    if (runtimeSpecifier) {
      runtimeSpecifiers.push(runtimeSpecifier);
    }
  }

  return { runtimeSpecifiers, typeSpecifiers };
}

function buildNamedReactImportReplacement(rawSpecifiers, runtimeTarget) {
  const { runtimeSpecifiers, typeSpecifiers } =
    partitionNamedSpecifiers(rawSpecifiers);

  if (!runtimeSpecifiers.length) {
    return null;
  }

  const lines = [];
  if (typeSpecifiers.length) {
    lines.push(`import type { ${typeSpecifiers.join(', ')} } from 'react';`);
  }
  lines.push(`const { ${runtimeSpecifiers.join(', ')} } = ${runtimeTarget};`);

  return lines.join('\n');
}

function patchAstroReactRenderer(code) {
  return replaceImportBlock(
    code,
    'import React from "react";\nimport ReactDOM from "react-dom/server";',
    [
      'import { createRequire as __astroReactCreateRequire } from "node:module";',
      'const __astroReactRequire = __astroReactCreateRequire(import.meta.url);',
      'const React = __astroReactRequire("react");',
      'const ReactDOM = __astroReactRequire("react-dom/server");',
    ],
  );
}

function patchAstroReactHelpers(code) {
  return (
    replaceImportBlock(
      code,
      'import { createElement as h, memo } from "react";',
      [
        'import { createRequire as __astroReactCreateRequire } from "node:module";',
        'const { createElement: h, memo } = __astroReactCreateRequire(import.meta.url)("react");',
      ],
    ) ??
    replaceImportBlock(
      code,
      'import { createElement, Fragment } from "react";',
      [
        'import { createRequire as __astroReactCreateRequire } from "node:module";',
        'const { createElement, Fragment } = __astroReactCreateRequire(import.meta.url)("react");',
      ],
    )
  );
}

function patchWorkspaceReactImports(code) {
  let changed = false;

  const patched = code
    .replace(
      /^import\s+([A-Za-z_$][\w$]*)\s*,\s*\{([^;]*?)\}\s+from\s+['"]react['"];?$/gm,
      (_, defaultImport, rawSpecifiers) => {
        const namedReplacement = buildNamedReactImportReplacement(
          rawSpecifiers,
          defaultImport,
        );
        if (!namedReplacement) {
          return _;
        }

        changed = true;
        return [
          `const ${defaultImport} = __astroReactRequire('react');`,
          namedReplacement,
        ].join('\n');
      },
    )
    .replace(
      /^import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]react['"];?$/gm,
      (_, namespaceImport) => {
        changed = true;
        return `const ${namespaceImport} = __astroReactRequire('react');`;
      },
    )
    .replace(
      /^import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]react['"];?$/gm,
      (_, defaultImport) => {
        changed = true;
        return `const ${defaultImport} = __astroReactRequire('react');`;
      },
    )
    .replace(
      /^import\s+\{([^;]*?)\}\s+from\s+['"]react['"];?$/gm,
      (_, rawSpecifiers) => {
        const replacement = buildNamedReactImportReplacement(
          rawSpecifiers,
          "__astroReactRequire('react')",
        );
        if (!replacement) {
          return _;
        }

        changed = true;
        return replacement;
      },
    );

  return changed ? injectReactRequirePreamble(patched) : null;
}

export function reactSsrCjsWorkaround() {
  return {
    name: 'portfolio:react-ssr-cjs-workaround',
    enforce: 'pre',
    resolveId(source, _importer, options) {
      if (options?.ssr && SSR_REACT_EXTERNALS.has(source)) {
        return {
          id: pathToFileURL(nodeRequire.resolve(source)).href,
          external: true,
        };
      }

      return null;
    },
    transform(code, id, options) {
      if (!options?.ssr) {
        return null;
      }

      if (matchesAny(id, ASTRO_REACT_RENDERER_FILES)) {
        const patched = patchAstroReactRenderer(code);
        return patched ? { code: patched, map: null } : null;
      }

      if (matchesAny(id, ASTRO_REACT_HELPER_FILES)) {
        const patched = patchAstroReactHelpers(code);
        return patched ? { code: patched, map: null } : null;
      }

      if (matchesAny(id, WORKSPACE_SSR_REACT_ROOTS)) {
        const patched = patchWorkspaceReactImports(code);
        return patched ? { code: patched, map: null } : null;
      }

      return null;
    },
  };
}
