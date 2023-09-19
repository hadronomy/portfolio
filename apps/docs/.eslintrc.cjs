module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "@portofolio/eslint-config/base",
    "@portofolio/eslint-config/react",
    "plugin:storybook/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  plugins: ["react-refresh"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
};
