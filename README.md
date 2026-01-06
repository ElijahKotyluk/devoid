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
```

## Commmon Flags

```sh
devoid src/ --exports
devoid src/ --files
devoid src/ --locals
devoid src/ --json
```

## Analysis Modes

### Unused Exports

List exports that are never imported or referenced:

```sh
devoid src/ --exports
```

### Unused Files

List files that are unreachable from the entrypoints and have no side effects:

```sh
devoid src/ --files
```

### Unused Local Identifiers

Detect unused classes, enums, functions, and variables within files:

```sh
devoid src/ --locals
# or
devoid src/ --identifiers
```

Enable strict mode to include type declarations:

```sh
devoid src/ --locals --track-all-locals
```

### Types

Detect unused exported types and local type declarations:

```sh
devoid src/ --types
```

Types mode:
  - Tracks type and interface usage only
  - Respects import type and export type
  - Follows barrel and wildcard type re-exports
  - Does not require the TypeScript type checker
  - Does not affect runtime export analysis


## Output Options

### JSON

```sh
devoid src/ --json
```

### Summary

```sh
devoid src/ --summary-only
```

### Verbose

Print raw graphs for debugging:

```sh
devoid src/ --verbose
```

## Internal (Single-File) Analysis

Analyze unused identifiers within a single file only:

```sh
devoid internal src/utils/helpers.ts
```

Enable strict local tracking:

```sh
devoid internal src/utils/helpers.ts --track-all-locals
```

## Misc Options

### Ignore Paths

Ignore files or directories containing a substring:

```sh
devoid src/ --ignore dist --ignore generated
```

### Color Control

```sh
devoid src/ --no-color
devoid src/ --color
```

## License

MIT © Elijah Kotyluk
