import * as vscode from "vscode";
import { registerCompletionProvider } from "./css-completion";

export function activate(context: vscode.ExtensionContext): void {
  registerCompletionProvider(context);
}

export function deactivate(): void {}