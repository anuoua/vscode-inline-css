# Inline CSS

Syntax highlighting and IntelliSense for CSS in `/*css*/` tagged template strings.

## Usage

Tag your template strings with `/*css*/` to get CSS syntax highlighting and autocompletion:

```js
const style = /*css*/`
  .container {
    display: flex;
    color: ${theme.color};
  }
`;
```

## Features

- **Syntax highlighting** — CSS properties, values, selectors, and media queries are highlighted inside tagged template strings
- **IntelliSense** — CSS property names, values, and snippets autocompletion
- **Interpolation support** — `${...}` expressions are correctly handled and highlighted as TypeScript/JavaScript

## Supported Languages

JavaScript, TypeScript, JSX, and TSX files.

## Development

```bash
npm install
npm run compile
```

To package as VSIX:

```bash
npm run package
```