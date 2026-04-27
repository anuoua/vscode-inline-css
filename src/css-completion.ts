import * as vscode from "vscode";
import {
  getCSSLanguageService,
  LanguageService,
  TextDocument as CssTextDocument,
  CompletionList,
  Position as CssPosition,
  TextEdit as CssTextEdit,
} from "vscode-css-languageservice";
import { InsertReplaceEdit } from "vscode-languageserver-types";
import { findCssRegions, CssRegion, InterpolationOffset } from "./css-region-finder";

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
    const stylesheet = cssLanguageService.parseStylesheet(virtualDoc);

    const completions = cssLanguageService.doComplete(
      virtualDoc,
      virtualPosition,
      stylesheet
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
  const originalChar =
    position.line === region.startLine
      ? position.character - region.startChar
      : position.character;
  const virtualChar = originalCharToVirtual(originalChar, region.interpolationOffsets);
  return CssPosition.create(line, virtualChar);
}

function originalCharToVirtual(
  originalChar: number,
  offsets: InterpolationOffset[]
): number {
  let shift = 0;
  for (const offset of offsets) {
    if (originalChar >= offset.originalEnd) {
      shift += offset.virtualLength - (offset.originalEnd - offset.originalStart);
    } else if (originalChar > offset.originalStart) {
      shift += originalChar - offset.originalStart;
      return offset.originalStart + shift;
    }
  }
  return originalChar + shift;
}

function virtualCharToOriginal(
  virtualChar: number,
  offsets: InterpolationOffset[]
): number {
  let shift = 0;
  for (const offset of offsets) {
    const originalLength = offset.originalEnd - offset.originalStart;
    const virtualStart = offset.originalStart + shift;
    const virtualEnd = virtualStart + offset.virtualLength;
    if (virtualChar >= virtualEnd) {
      shift += offset.virtualLength - originalLength;
    } else if (virtualChar >= virtualStart) {
      return offset.originalStart + (virtualChar - virtualStart);
    }
  }
  return virtualChar - shift;
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
    const insertText = item.textEdit
      ? item.textEdit.newText
      : item.insertText || item.label;
    vscodeItem.insertText = typeof insertText === "string"
      ? new vscode.SnippetString(insertText)
      : insertText;

    if (insertText && typeof insertText === "string" && insertText.includes("$0")) {
      vscodeItem.command = {
        command: "editor.action.triggerSuggest",
        title: "Trigger suggest"
      };
    }

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
  textEdit: CssTextEdit | InsertReplaceEdit,
  region: CssRegion
): vscode.Range | undefined {
  let cssRange: { start: CssPosition; end: CssPosition };

  if (InsertReplaceEdit.is(textEdit)) {
    cssRange = textEdit.replace;
  } else {
    cssRange = textEdit.range;
  }

  const startLine = cssRange.start.line + region.startLine;
  const startVirtualChar = cssRange.start.character;
  const startOriginalChar = virtualCharToOriginal(startVirtualChar, region.interpolationOffsets);
  const startChar =
    cssRange.start.line === 0
      ? startOriginalChar + region.startChar
      : startOriginalChar;

  const endLine = cssRange.end.line + region.startLine;
  const endVirtualChar = cssRange.end.character;
  const endOriginalChar = virtualCharToOriginal(endVirtualChar, region.interpolationOffsets);
  const endChar =
    cssRange.end.line === 0
      ? endOriginalChar + region.startChar
      : endOriginalChar;

  return new vscode.Range(startLine, startChar, endLine, endChar);
}