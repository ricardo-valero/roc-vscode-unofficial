import * as vscode from 'vscode';
import * as util from './util';

export type Api = ReturnType<typeof create>;

export function create(ctx: vscode.ExtensionContext): vscode.OutputChannel {
  const outputChannel = vscode.window.createOutputChannel(
    'Roc Language Server',
  );
  ctx.subscriptions.push(outputChannel);
  return outputChannel;
}

function fixedLength(string: string, length: number): string {
  return string.length < length
    ? string.padEnd(length)
    : string.slice(0, length);
}

export const outputFormatter =
  (type: 'Info' | 'Warn' | 'Error') => (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    return `[${fixedLength(type, 5)} - ${timestamp}] ${message}`;
  };
