/** @type {import("eslint").Linter.Config} */
const config = {
  extends: [
    '@portofolio/eslint-config/base',
    '@portofolio/eslint-config/next',
    '@portofolio/eslint-config/react'
  ],
  root: true
};

module.exports = config;
