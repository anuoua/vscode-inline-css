# vscode-inline-css 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个 VSCode 扩展，为 JS/TS 文件中 `/*css*/` 标记的模板字符串提供 CSS 语法高亮和 IntelliSense 补全。

**Architecture:** 通过 TextMate grammar injection 实现语法高亮（将 `/*css*/` 模板字符串区域标记为 CSS 上下文），通过 `vscode-css-languageservice` 实现补全（扫描文档找到 CSS 区域，创建虚拟 CSS 文档提供补全建议）。

**Tech Stack:** TypeScript, VSCode Extension API, vscode-css-languageservice, TextMate Grammar Injection

---

## 文件结构

| 文件 | 责责 |
|------|------|
| `package.json` | 扩展清单：激活事件、grammar 贡献、依赖声明 |
| `syntaxes/inline-css.json` | TextMate grammar 注入规则：匹配 `/*css*/` 模板字符串，标记为 CSS |
| `src/extension.ts` | 扩展入口：activate/deactivate，注册 CompletionProvider |
| `src/css-completion.ts` | CSS 补全提供器：使用 vscode-css-languageservice 提供补全 |
| `src/css-region-finder.ts` | CSS 区域查找器：解析文档找到 `/*css*/` 模板字符串的位置范围 |

---

### Task 1: 项目初始化与 package.json 配置

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 更新 package.json 为 VSCode 扩展格式**

将现有空 package.json 替换为完整的 VSCode 扩展配置：

```json
{
  "name": "vscode-inline-css",
  "displayName": "Inline CSS",
  "description": "Syntax highlighting and IntelliSense for CSS in /*css*/ tagged template strings",
  "version": "0.0.1",
  "publisher": "inline-css",
  "engines": {
    "vscode": "^1.90.0"
  },
  "categories": [
    "Programming Languages"
  ],
  "activationEvents": [
    "onLanguage:javascript",
    "onLanguage:typescript",
    "onLanguage:javascriptreact",
    "onLanguage:typescriptreact"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "grammars": [
      {
        "injectTo": [
          "source.js",
          "source.ts",
          "source.js.jsx",
          "source.tsx"
        ],
        "scopeName": "inline.css",
        "path": "./syntaxes/inline-css.json",
        "embeddedLanguages": {
          "meta.embedded.block.css": "css",
          "meta.embedded.line.ts": "typescript"
        }
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src --ext ts"
  },
  "devDependencies": {
    "@types/vscode": "^1.90.0",
    "@types/node": "^20.11.0",
    "typescript": "^5.4.0",
    "eslint": "^8.57.0"
  },
  "dependencies": {
    "vscode-css-languageservice": "^6.3.0",
    "vscode-languageserver-textdocument": "^1.0.11",
    "vscode-languageserver-types": "^3.17.5"
  },
  "packageManager": "pnpm@10.30.3"
}
```

- [ ] **Step 2: 安装依赖**

Run: `pnpm install`
Expected: 依赖安装成功，无错误

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.json pnpm-lock.yaml node_modules/.package-lock.json
git commit -m "feat: initialize VSCode extension project with dependencies"
```

---

### Task 2: Grammar Injection 规则

**Files:**
- Create: `syntaxes/inline-css.json`

- [ ] **Step 1: 创建 grammar 注入规则文件**

创建 `syntaxes/inline-css.json`，定义匹配 `/*css*/` 模板字符串的 TextMate grammar：

```json
{
  "scopeName": "inline.css",
  "injectionSelector": "L:source.js -comment -string, L:source.ts -comment -string, L:source.js.jsx -comment -string, L:source.tsx -comment -string",
  "patterns": [
    {
      "contentName": "meta.embedded.block.css",
      "begin": "(\\/\\*css\\*\\/\\s*)(`)",
      "beginCaptures": {
        "1": {
          "name": "comment.block.css-marker.js"
        },
        "2": {
          "name": "punctuation.definition.string.template.begin.js"
        }
      },
      "end": "`",
      "endCaptures": {
        "0": {
          "name": "punctuation.definition.string.template.end.js"
        }
      },
      "patterns": [
        {
          "contentName": "meta.embedded.line.ts",
          "begin": "\\$\\{",
          "beginCaptures": {
            "0": {
              "name": "punctuation.definition.template-expression.begin.js"
            }
          },
          "end": "\\}",
          "endCaptures": {
            "0": {
              "name": "punctuation.definition.template-expression.end.js"
            }
          },
          "patterns": [
            {
              "include": "source.ts#expression"
            }
          ]
        },
        {
          "include": "source.css"
        }
      ]
    }
  ]
}
```

关键设计点：
- `injectionSelector` 使用 `L:source -comment -string` 确保只在源码区域（非注释/字符串内部）匹配
- `contentName` 使用 `meta.embedded.block.css` 而非 `source.css`，配合 `embeddedLanguages` 映射使 VSCode 将该区域识别为 CSS 语言上下文
- `${...}` 模板表达式使用 `meta.embedded.line.ts` 映射回 TypeScript，保留 JS/TS 高亮
- 内部 patterns 先匹配 `${...}`，再 include `source.css` 处理 CSS 内容

- [ ] **Step 2: 验证 grammar JSON 格式正确**

Run: `node -e "const g = require('./syntaxes/inline-css.json'); console.log('scopeName:', g.scopeName); console.log('patterns count:', g.patterns.length); console.log('OK')"`
Expected: 输出 scopeName 和 patterns count，无 JSON 解析错误

- [ ] **Step 3: Commit**

```bash
git add syntaxes/inline-css.json
git commit -m "feat: add TextMate grammar injection for /*css*/ template strings"
```

---

### Task 3: CSS 区域查找器

**Files:**
- Create: `src/css-region-finder.ts`

- [ ] **Step 1: 创建 CSS 区域查找模块**

创建 `src/css-region-finder.ts`，解析文档找到所有 `/*css*/` 标记的模板字符串位置：

```typescript
import * as vscode from "vscode";

export interface CssRegion {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
  cssContent: string;
}

export function findCssRegions(document: vscode.TextDocument): CssRegion[] {
  const text = document.getText();
  const regions: CssRegion[] = [];
  const markerRegex = /\/\*css\*\/\s*`/g;
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(text)) !== null) {
    const templateStart = match.index + match[0].length - 1;
    const templateEnd = findTemplateEnd(text, templateStart);
    if (templateEnd === -1) {
      continue;
    }

    const contentStart = templateStart + 1;
    const contentEnd = templateEnd;
    const cssContent = text.substring(contentStart, contentEnd);

    const startPos = document.positionAt(contentStart);
    const endPos = document.positionAt(contentEnd);

    regions.push({
      startLine: startPos.line,
      startChar: startPos.character,
      endLine: endPos.line,
      endChar: endPos.character,
      cssContent: replaceInterpolations(cssContent),
    });
  }

  return regions;
}

function findTemplateEnd(text: string, templateStart: number): number {
  let depth = 0;
  let i = templateStart + 1;
  while (i < text.length) {
    if (text[i] === "$" && text[i + 1] === "{") {
      depth++;
      i += 2;
    } else if (text[i] === "}" && depth > 0) {
      depth--;
      i++;
    } else if (text[i] === "`" && depth === 0) {
      return i;
    } else {
      i++;
    }
  }
  return -1;
}

function replaceInterpolations(cssContent: string): string {
  return cssContent.replace(/\$\{[^}]*\}/g, "/* __placeholder__ */");
}
```

关键设计点：
- `findCssRegions` 扫描文档找到所有 `/*css*/` 后的模板字符串
- `findTemplateEnd` 正确处理 `${...}` 嵌套，不会在插值内的反引号处误终止
- `replaceInterpolations` 将 `${...}` 替换为 CSS 注释占位符，使 CSS Language Service 能正确解析（不会因为 JS 表达式语法报错）
- 返回的 `CssRegion` 包含行列位置和纯 CSS 内容

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `pnpm run compile`
Expected: 编译成功，无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/css-region-finder.ts
git commit -m "feat: add CSS region finder for /*css*/ template strings"
```

---

### Task 4: CSS 补全提供器

**Files:**
- Create: `src/css-completion.ts`

- [ ] **Step 1: 创建 CSS 补全提供器**

创建 `src/css-completion.ts`，使用 `vscode-css-languageservice` 提供补全：

```typescript
import * as vscode from "vscode";
import {
  getCSSLanguageService,
  LanguageService,
  TextDocument as CssTextDocument,
  CompletionList,
  Position as CssPosition,
} from "vscode-css-languageservice";
import { findCssRegions, CssRegion } from "./css-region-finder";

const cssLanguageService: LanguageService = getCSSLanguageService();

export function registerCompletionProvider(
  context: vscode.ExtensionContext
): void {
  const provider = new InlineCssCompletionProvider();

  const jsDisposable = vscode.languages.registerCompletionItemProvider(
    ["javascript", "typescript", "javascriptreact", "typescriptreact"],
    provider,
    " ",
    ":",
    "-",
    "{",
    ".",
    "#"
  );

  context.subscriptions.push(jsDisposable);
}

class InlineCssCompletionProvider
  implements vscode.CompletionItemProvider
{
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] | vscode.CompletionList | undefined {
    const regions = findCssRegions(document);
    const region = findRegionAtPosition(regions, position);
    if (!region) {
      return undefined;
    }

    const virtualDoc = createVirtualCssDocument(document, region);
    const virtualPosition = mapToVirtualPosition(position, region);

    const completions = cssLanguageService.doComplete(
      virtualDoc,
      virtualPosition,
      cssLanguageService.doValidation(virtualDoc)
    );

    return mapCompletionsToVscode(completions, region);
  }
}

function findRegionAtPosition(
  regions: CssRegion[],
  position: vscode.Position
): CssRegion | undefined {
  for (const region of regions) {
    if (
      position.line >= region.startLine &&
      position.line <= region.endLine &&
      !(position.line === region.startLine && position.character < region.startChar) &&
      !(position.line === region.endLine && position.character > region.endChar)
    ) {
      return region;
    }
  }
  return undefined;
}

function createVirtualCssDocument(
  document: vscode.TextDocument,
  region: CssRegion
): CssTextDocument {
  const uri = document.uri.toString() + ".css";
  return CssTextDocument.create(uri, "css", 0, region.cssContent);
}

function mapToVirtualPosition(
  position: vscode.Position,
  region: CssRegion
): CssPosition {
  const line = position.line - region.startLine;
  const char =
    position.line === region.startLine
      ? position.character - region.startChar
      : position.character;
  return CssPosition.create(line, char);
}

function mapCompletionsToVscode(
  completions: CompletionList,
  region: CssRegion
): vscode.CompletionList {
  const items = completions.items.map((item) => {
    const vscodeItem = new vscode.CompletionItem(item.label);
    vscodeItem.kind = mapCompletionKind(item.kind);
    vscodeItem.detail = item.detail;
    vscodeItem.documentation = item.documentation
      ? typeof item.documentation === "string"
        ? item.documentation
        : item.documentation.value
      : undefined;
    vscodeItem.sortText = item.sortText;
    vscodeItem.filterText = item.filterText;
    vscodeItem.insertText = item.textEdit
      ? item.textEdit.newText
      : item.insertText || item.label;

    if (item.textEdit) {
      const editRange = mapTextEditRange(item.textEdit, region);
      if (editRange) {
        vscodeItem.range = editRange;
      }
    }

    return vscodeItem;
  });

  return new vscode.CompletionList(items, completions.isIncomplete);
}

function mapCompletionKind(
  kind: number | undefined
): vscode.CompletionItemKind {
  if (kind === undefined) {
    return vscode.CompletionItemKind.Property;
  }
  const kindMap: Record<number, vscode.CompletionItemKind> = {
    5: vscode.CompletionItemKind.Value,
    10: vscode.CompletionItemKind.Property,
    12: vscode.CompletionItemKind.Function,
    13: vscode.CompletionItemKind.Variable,
    14: vscode.CompletionItemKind.Constant,
    17: vscode.CompletionItemKind.Keyword,
    18: vscode.CompletionItemKind.Snippet,
  };
  return kindMap[kind] || vscode.CompletionItemKind.Property;
}

function mapTextEditRange(
  textEdit: { range: { startLine: number; startCharacter: number; endLine: number; endCharacter: number } },
  region: CssRegion
): vscode.Range | undefined {
  const startLine = textEdit.range.startLine + region.startLine;
  const startChar =
    textEdit.range.startLine === 0
      ? textEdit.range.startCharacter + region.startChar
      : textEdit.range.startCharacter;
  const endLine = textEdit.range.endLine + region.startLine;
  const endChar =
    textEdit.range.endLine === 0
      ? textEdit.range.endCharacter + region.startChar
      : textEdit.range.endCharacter;

  return new vscode.Range(startLine, startChar, endLine, endChar);
}
```

关键设计点：
- 使用 `vscode-css-languageservice` 的 `getCSSLanguageService()` 创建 CSS 语言服务实例
- `provideCompletionItems` 先找到当前光标所在的 CSS 区域，然后创建虚拟 CSS 文档，将光标位置映射到虚拟文档中
- `${...}` 插值已被替换为 CSS 注释占位符，CSS Language Service 能正确解析
- 补全结果从虚拟文档坐标映射回原始文档坐标
- 触发字符包括空格、冒号、连字符、花括号、点号、井号——覆盖 CSS 补全的常见触发场景

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `pnpm run compile`
Expected: 编译成功，无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/css-completion.ts
git commit -m "feat: add CSS completion provider using vscode-css-languageservice"
```

---

### Task 5: 扩展入口

**Files:**
- Create: `src/extension.ts`

- [ ] **Step 1: 创建扩展入口文件**

创建 `src/extension.ts`：

```typescript
import * as vscode from "vscode";
import { registerCompletionProvider } from "./css-completion";

export function activate(context: vscode.ExtensionContext): void {
  registerCompletionProvider(context);
}

export function deactivate(): void {}
```

- [ ] **Step 2: 验证完整编译**

Run: `pnpm run compile`
Expected: 编译成功，dist 目录下生成 extension.js

- [ ] **Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "feat: add extension entry point"
```

---

### Task 6: 手动测试与验证

**Files:**
- 无新文件

- [ ] **Step 1: 打包扩展为 VSIX**

Run: `pnpm add -D @vscode/vsce && vsce package`
Expected: 生成 `vscode-inline-css-0.0.1.vsix` 文件

- [ ] **Step 2: 在 VSCode 中安装并测试**

1. 在 VSCode 中通过 "Extensions: Install from VSIX..." 安装生成的 VSIX
2. 创建一个测试 JS 文件，内容如下：

```javascript
const style = /*css*/`
.main {
  height: 100%;
  color: red;
  background: ${bgColor};
  font-size: 14px;
}
`;
```

3. 验证高亮：CSS 属性名、属性值、选择器应有颜色区分
4. 验证 `${bgColor}` 保留 JS 高亮
5. 验证补全：在 CSS 区域内输入属性名前缀（如 `col`），应出现 CSS 属性补全建议
6. 验证非 CSS 区域不受影响：普通模板字符串无 CSS 高亮和补全

- [ ] **Step 3: 根据测试结果修复问题（如有）**

如果高亮或补全有问题，根据实际表现调整 grammar 规则或补全逻辑。

- [ ] **Step 4: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: adjust grammar/completion based on manual testing"
```

---

## 自审检查

1. **Spec 覆盖度**：设计规格中的所有需求都有对应任务——高亮（Task 2）、补全（Task 4）、JS/TS 文件支持（Task 1 的 activationEvents）、`${...}` 处理（Task 2 grammar + Task 3 replaceInterpolations）
2. **占位符扫描**：无 TBD/TODO，所有步骤包含完整代码
3. **类型一致性**：`CssRegion` 接口在 Task 3 定义，Task 4 使用相同的字段名（startLine, startChar, endLine, endChar, cssContent），一致