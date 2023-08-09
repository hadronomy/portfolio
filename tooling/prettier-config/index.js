/** @type {import("prettier").Options} */
const config = {
  plugins: [
    "prettier-plugin-tailwindcss",
    "@ianvs/prettier-plugin-sort-imports",
  ],
  trailingComma: "all",
  arrowParens: "always",
  jsxSingleQuote: false,
  singleQuote: true,
  importOrderTypeScriptVersion: "4.4.0",
  importOrder: [
    "^(react/(.*)$)|^(react$)|^(react-native(.*)$)",
    "^(next/(.*)$)|^(next$)",
    "^(expo(.*)$)|^(expo$)",
    "<THIRD_PARTY_MODULES>",
    "",
    "^@acme/(.*)$",
    "",
    "^~/utils/(.*)$",
    "^~/components/(.*)$",
    "^~/styles/(.*)$",
    "^~/(.*)$",
    "^[./]",
  ],
};

module.exports = config;
