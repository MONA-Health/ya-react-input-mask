const OFF = 0;
// const WARN = 1;
const ERROR = 2;

module.exports = {
  // parser: "babel-eslint",
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    project: ["./tsconfig.json"]
  },
  extends: [
    "airbnb",
    "airbnb-typescript",
    "prettier",
    "plugin:@typescript-eslint/recommended"
  ],
  plugins: ["prettier", "react-hooks", "@typescript-eslint"],
  root: true,
  env: {
    browser: true
  },
  rules: {
    "react/jsx-filename-extension": OFF,
    "react/jsx-props-no-spreading": OFF,
    "react/require-default-props": OFF,
    "react/no-find-dom-node": OFF,
    "react/prop-types": [ERROR, { ignore: ["value", "defaultValue"] }],
    "react-hooks/rules-of-hooks": ERROR,
    "react-hooks/exhaustive-deps": ERROR,
    "no-shadow": OFF,
    "no-param-reassign": OFF,
    "no-plusplus": OFF,
    "global-require": OFF,
    "consistent-return": OFF,
    "prefer-const": [
      ERROR,
      {
        destructuring: "all"
      }
    ],
    "prettier/prettier": ERROR,
    "@typescript-eslint/no-explicit-any": OFF
  }
};
