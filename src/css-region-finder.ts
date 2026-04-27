import * as vscode from "vscode";

export interface InterpolationOffset {
  originalStart: number;
  originalEnd: number;
  virtualLength: number;
}

export interface CssRegion {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
  cssContent: string;
  interpolationOffsets: InterpolationOffset[];
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
    const { replaced, offsets } = replaceInterpolations(cssContent);

    const startPos = document.positionAt(contentStart);
    const endPos = document.positionAt(contentEnd);

    regions.push({
      startLine: startPos.line,
      startChar: startPos.character,
      endLine: endPos.line,
      endChar: endPos.character,
      cssContent: replaced,
      interpolationOffsets: offsets,
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

function replaceInterpolations(cssContent: string): { replaced: string; offsets: InterpolationOffset[] } {
  let result = "";
  const offsets: InterpolationOffset[] = [];
  let i = 0;
  while (i < cssContent.length) {
    if (cssContent[i] === "$" && cssContent[i + 1] === "{") {
      const interpStart = i;
      const end = findInterpolationEnd(cssContent, i + 2);
      if (end !== -1) {
        const placeholder = "/* __placeholder__ */";
        offsets.push({
          originalStart: interpStart,
          originalEnd: end + 1,
          virtualLength: placeholder.length,
        });
        result += placeholder;
        i = end + 1;
      } else {
        result += cssContent[i];
        i++;
      }
    } else {
      result += cssContent[i];
      i++;
    }
  }
  return { replaced: result, offsets };
}

function findInterpolationEnd(text: string, start: number): number {
  let depth = 1;
  let i = start;
  while (i < text.length) {
    if (text[i] === "{") {
      depth++;
      i++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        return i;
      }
      i++;
    } else {
      i++;
    }
  }
  return -1;
}