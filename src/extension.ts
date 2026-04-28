import * as vscode from "vscode";
import { registerCompletionProvider } from "./css-completion";
import { registerFormattingProvider } from "./css-formatter";

export function activate(context: vscode.ExtensionContext): void {
  registerCompletionProvider(context);
  registerFormattingProvider(context);
}

export function deactivate(): void {}