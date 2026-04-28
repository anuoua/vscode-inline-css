import * as vscode from "vscode";
import {
  getCSSLanguageService,
  LanguageService,
  TextDocument as CssTextDocument,
  CSSFormatConfiguration,
} from "vscode-css-languageservice";
import { findCssRegions, CssRegion } from "./css-region-finder";

const cssLanguageService: LanguageService = getCSSLanguageService();

export function registerFormattingProvider(
  context: vscode.ExtensionContext
): void {
  const disposable = vscode.commands.registerTextEditorCommand(
    "inlineCss.format",
    (textEditor: vscode.TextEditor) => {
      const document = textEditor.document;
      const options: vscode.FormattingOptions = {
        tabSize: vscode.workspace.getConfiguration("editor", document.uri).get<number>("tabSize", 4),
        insertSpaces: vscode.workspace.getConfiguration("editor", document.uri).get<boolean>("insertSpaces", true),
      };

      const regions = findCssRegions(document);
      const edits: vscode.TextEdit[] = [];

      for (const region of regions) {
        const edit = formatCssRegion(document, region, options);
        if (edit) {
          edits.push(edit);
        }
      }

      if (edits.length > 0) {
        textEditor.edit((editBuilder) => {
          for (const edit of edits) {
            editBuilder.replace(edit.range, edit.newText);
          }
        });
      }
    }
  );

  context.subscriptions.push(disposable);
}

function formatCssRegion(
  document: vscode.TextDocument,
  region: CssRegion,
  options: vscode.FormattingOptions
): vscode.TextEdit | undefined {
  if (region.cssContent.trim().length === 0) {
    return undefined;
  }

  const virtualDoc = CssTextDocument.create(
    document.uri.toString() + ".css",
    "css",
    0,
    region.cssContent
  );

  const cssFormatOptions: CSSFormatConfiguration = {
    tabSize: options.tabSize,
    insertSpaces: options.insertSpaces,
  };

  const formatEdits = cssLanguageService.format(
    virtualDoc,
    undefined,
    cssFormatOptions
  );

  if (formatEdits.length === 0) {
    return undefined;
  }

  const formattedText = formatEdits[0].newText;

  const markerLineIndex = findMarkerLineIndex(document, region);
  const baseIndent = getLineIndentString(document, markerLineIndex, options);
  const oneLevelIndent = options.insertSpaces
    ? " ".repeat(options.tabSize)
    : "\t";

  const reindentedText = reindentFormattedCss(
    formattedText,
    baseIndent,
    oneLevelIndent
  );

  const restoredText = restoreInterpolations(reindentedText, region);

  const range = new vscode.Range(
    region.startLine,
    region.startChar,
    region.endLine,
    region.endChar
  );

  return new vscode.TextEdit(range, restoredText);
}

function findMarkerLineIndex(
  document: vscode.TextDocument,
  region: CssRegion
): number {
  const text = document.getText();
  const regionStartOffset = document.offsetAt(
    new vscode.Position(region.startLine, region.startChar)
  );

  const markerRegex = /\/\*css\*\/\s*`/g;
  let match: RegExpExecArray | null;
  while ((match = markerRegex.exec(text)) !== null) {
    const templateStart = match.index + match[0].length - 1;
    const contentStart = templateStart + 1;
    const contentStartPos = document.positionAt(contentStart);
    if (
      contentStartPos.line === region.startLine &&
      contentStartPos.character === region.startChar
    ) {
      return document.positionAt(match.index).line;
    }
  }
  return region.startLine;
}

function getLineIndentString(
  document: vscode.TextDocument,
  lineIndex: number,
  options: vscode.FormattingOptions
): string {
  const line = document.lineAt(lineIndex);
  const leadingWhitespace = line.text.substring(
    0,
    line.firstNonWhitespaceCharacterIndex
  );
  return leadingWhitespace;
}

function reindentFormattedCss(
  formattedText: string,
  baseIndent: string,
  oneLevelIndent: string
): string {
  const lines = formattedText.split("\n");
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const currentIndentLevel = (line.length - trimmed.length) / oneLevelIndent.length;

    if (i === lines.length - 1 && trimmed.length === 0) {
      continue;
    }

    resultLines.push(baseIndent + oneLevelIndent.repeat(currentIndentLevel + 1) + trimmed);
  }

  return "\n" + resultLines.join("\n") + "\n" + baseIndent;
}

function restoreInterpolations(
  text: string,
  region: CssRegion
): string {
  const placeholder = "/* __placeholder__ */";
  let result = text;
  for (const offset of region.interpolationOffsets) {
    result = result.replace(placeholder, offset.originalText);
  }
  return result;
}