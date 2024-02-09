/** @type {import("eslint").Linter.Config} */
const config = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'turbo',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      },
    ],
    '@typescript-eslint/consistent-type-definitions': ['warn', 'type'],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-misused-promises': [
      2,
      { checksVoidReturn: { attributes: false } },
    ],
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
  },
  ignorePatterns: [
    '**/.eslintrc.cjs',
    '**/*.config.js',
    '**/*.config.cjs',
    'packages/config/**',
    '.next',
    'dist',
    'pnpm-lock.yaml',
  ],
  reportUnusedDisableDirectives: true,
};

module.exports = config;
