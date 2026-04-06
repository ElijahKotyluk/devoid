// eslint.config.js — Flat Config (ESLint ≥ v9)

import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierPluginRecommended from "eslint-plugin-prettier/recommended";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ["dist/**", "node_modules/**", "test/**/fixtures/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: path.join(__dirname, "tsconfig.json"),
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },

    plugins: {
      "@typescript-eslint": tsPlugin,
    },

    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-var-requires": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  {
    files: ["test/**/*.ts"],
    ignores: ["**/fixtures/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: path.join(__dirname, "test", "tsconfig.json"),
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
  prettierPluginRecommended,
];
