/** @type {import("eslint").Linter.Config} */
const config = {
  extends: [
    "@portfolio/eslint-config/base",
    "@portfolio/eslint-config/next",
    "@portfolio/eslint-config/react",
  ],
  root: true,
};

module.exports = config;
