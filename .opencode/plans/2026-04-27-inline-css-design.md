# vscode-inline-css Design Spec

## Overview

A VSCode extension that provides syntax highlighting and basic IntelliSense completion for CSS code embedded in JS/TS template strings marked with `/*css*/` comment tags.

## Problem Statement

When writing inline CSS in JavaScript/TypeScript code using the pattern `const str = /*css*/\`.main { height: 100%; }\``, the CSS content inside the template string is treated as plain text — no syntax highlighting, no autocompletion. This makes it harder to read and write embedded CSS.

## Target Pattern

```javascript
const str = /*css*/`.main {
  height: 100%;
  color: red;
}`
```

- Marker: `/*css*/` block comment immediately before a template literal (backtick string)
- Only template literals (backtick strings) are supported, not single/double quoted strings
- Only the `/*css*/` marker is supported (no `/*style*/`, `//css`, etc.)
- Target file types: `.js`, `.jsx`, `.ts`, `.tsx`

## Architecture

### Approach: Grammar Injection + Built-in CSS Extension

Use VSCode's TextMate grammar injection mechanism to embed CSS language context into `/*css*/`-marked template strings. The built-in CSS extension then automatically provides syntax highlighting and basic completion (property names, values, selectors) within those regions.

### Components

#### 1. Grammar Injection (`syntaxes/inline-css.json`)

A TextMate grammar that injects into `source.js`, `source.ts`, `source.jsx`, and `source.tsx` scopes. It defines rules to:

- **Begin pattern**: Match `/*css*/` followed by a backtick, capturing the comment marker and template literal opening
- **End pattern**: Match the closing backtick of the template literal
- **Content name**: `source.css` — marks the content region as CSS, enabling VSCode's built-in CSS highlighting and completion
- **Template expression handling**: `${...}` interpolations inside the template string should be marked back as JavaScript/TypeScript scope so they retain their original highlighting

#### 2. Extension Entry (`src/extension.ts`)

Minimal extension entry point with `activate` and `deactivate` functions. The grammar injection is declarative via `package.json` contributes, so no runtime logic is needed for highlighting.

#### 3. Package Configuration (`package.json`)

Key configuration:
- `contributes.grammars`: Inject `inline-css.json` into JS/TS language scopes with `injectTo` targeting `source.js`, `source.ts`, `source.jsx`, `source.tsx`
- `activationEvents`: `onLanguage:javascript`, `onLanguage:typescript`, `onLanguage:javascriptreact`, `onLanguage:typescriptreact`

### File Structure

```
vscode-inline-css/
├── package.json              # Extension manifest with grammar contributions
├── syntaxes/
│   └─ inline-css.json        # TextMate grammar injection rules
└─ src/
    └─ extension.ts           # Extension entry point (minimal)
```

## Grammar Rule Design

The core grammar pattern:

```jsonc
{
  "scopeName": "inline.css",
  "injectionSelector": "L:source.js, L:source.ts, L:source.jsx, L:source.tsx",
  "patterns": [
    {
      "begin": "(?:\\/\\*css\\*\\/\\s*)(`)",
      "beginCaptures": {
        "1": { "name": "punctuation.definition.string.template.begin.js" }
      },
      "end": "`",
      "endCaptures": {
        "0": { "name": "punctuation.definition.string.template.end.js" }
      },
      "contentName": "source.css",
      "patterns": [
        {
          "begin": "\\$\\{",
          "beginCaptures": { "0": { "name": "punctuation.definition.template-expression.begin.js" } },
          "end": "\\}",
          "endCaptures": { "0": { "name": "punctuation.definition.template-expression.end.js" } },
          "name": "meta.template.expression.js",
          "patterns": [
            { "include": "source.js#expression" }
          ]
        }
      ]
    }
  ]
}
```

Note: The `include` for template expressions needs to reference the appropriate source language (JS vs TS). This may require separate patterns or a unified approach depending on VSCode's grammar structure.

## Completion Mechanism

No custom CompletionProvider is needed. By marking the content region as `source.css` via grammar injection, VSCode's built-in CSS extension automatically provides:
- CSS property name completion
- CSS property value completion
- CSS selector completion
- CSS at-rule completion

## Out of Scope (YAGNI)

- CSS variable completion (can be added later)
- CSS formatting/beautification
- CSS linting/diagnostics
- Support for single/double quoted strings
- Support for alternative markers (`/*style*/`, `//css`, etc.)
- Support for other file types beyond JS/TS/JSX/TSX

## Success Criteria

1. `/*css*/`-marked template strings display CSS syntax highlighting in JS/TS files
2. Template expressions `${...}` inside CSS template strings retain JS/TS highlighting
3. Basic CSS completion (property names, values) works inside `/*css*/`-marked regions
4. Extension activates only for JS/TS/JSX/TSX files
5. No impact on performance of non-CSS template strings