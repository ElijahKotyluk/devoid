# Devoid  
Dead-Code Analysis for JavaScript & TypeScript

<p>
  <a href="https://www.npmjs.com/package/devoid">
    <img alt="npm version" src="https://img.shields.io/npm/v/devoid.svg?label=version&color=4CAF50">
  </a>
  <a href="https://www.npmjs.com/package/devoid">
    <img alt="npm downloads" src="https://img.shields.io/npm/dm/devoid.svg?color=2196F3">
  </a>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="node" src="https://img.shields.io/node/v/devoid?color=yellow">
</p>

Devoid is a **fast static analyzer** that detects:

- Unused **exports**
- Unused **local identifiers** (functions, variables, classes, types)
- Unused **files**
- Incorrect or unreachable **re-exports**
- Usage propagation through **wildcards** and **barrel modules**
- Import resolution via **TS path aliases**, **directory imports**, and **relative paths**

Devoid is powered the **TypeScript Compiler API** directly at runtime — no other dependencies.

---

## Installation

### Global

```sh
npm install -g devoid
# or
pnpm add -g devoid
# or
yarn global add devoid
```

### Project

```sh
npm install -D devoid
# or
pnpm add -D devoid
# or
yarn add -D devoid
```

## CLI Usage

```sh
devoid src/
devoid src/ --exports
devoid src/ --files
devoid src/ --locals
devoid src/ --json
```

## License

MIT © Elijah Kotyluk
