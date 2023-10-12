module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    '@portfolio/eslint-config/base',
    '@portfolio/eslint-config/react',
    'plugin:storybook/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
};
