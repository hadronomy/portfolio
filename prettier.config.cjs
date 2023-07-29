/** @type {import("prettier").Config} */
const config = {
  plugins: [require.resolve('prettier-plugin-tailwindcss')],
  trailingComma: 'none',
  arrowParens: 'always',
  jsxSingleQuote: false,
  singleQuote: true
};

module.exports = config;
