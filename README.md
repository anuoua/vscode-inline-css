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
- **Formatting** — Format CSS content inside tagged template strings via command palette (`Inline CSS: Format`), indentation aligns with surrounding code style

## Supported Languages

JavaScript, TypeScript, JSX, and TSX files.

## Formatting

Run **Inline CSS: Format** from the command palette (`Ctrl+Shift+P`) to format all `/*css*/` tagged template strings in the current document. The formatted CSS indentation aligns with the surrounding code, and `${...}` interpolations are preserved.

This works alongside other formatters like Prettier — it only formats the CSS inside `/*css*/` regions and does not conflict with your default document formatter.

## Development

```bash
npm install
npm run compile
```

To package as VSIX:

```bash
npm run package
```