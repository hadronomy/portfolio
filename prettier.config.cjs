/** @type {import("prettier").Config} */
const config = {
  plugins: [require.resolve('prettier-plugin-tailwindcss'), require.resolve('prettier-plugin-packagejson')],
  trailingComma: 'none',
  arrowParens: 'always',
  jsxSingleQuote: false,
  singleQuote: true
};

module.exports = config;
