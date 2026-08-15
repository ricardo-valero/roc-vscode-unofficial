import { Err, Ok, type Option, type Result } from 'ts-results';
import * as vscode from 'vscode';
import {
  CloseAction,
  ErrorAction,
  Executable,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import type { Api as ConfigReader } from './config-reader';
import { HEADER } from './constants';

function getServerOptions(config: {
  readonly languageServerRun: Option<string>;
  readonly languageServerDebug: Option<string>;
}): Result<ServerOptions, string> {
  if (config.languageServerRun.none) {
    return Err('getServerOptionsError');
  }
  const run = config.languageServerRun.map(
    (command): Executable => ({ command, transport: TransportKind.stdio }),
  ).val;
  const debug = config.languageServerDebug
    .map((command): Executable => ({ command, transport: TransportKind.stdio }))
    .unwrapOr(run);
  return Ok({ run, debug });
}

function getClientOptions(
  outputChannel: vscode.OutputChannel,
): Result<LanguageClientOptions, string> {
  return new Ok({
    documentSelector: [{ language: 'roc', scheme: 'file' }],
    progressOnInitialization: true,
    outputChannel,
    errorHandler: {
      closed: () => ({
        action: CloseAction.DoNotRestart,
      }),
      error: () => ({
        action: ErrorAction.Shutdown,
      }),
    },
  });
}

export type Api = ReturnType<typeof create>;

export function create(
  outputChannel: vscode.OutputChannel,
  configReader: ConfigReader,
) {
  const config = configReader.load();
  const languageClient = getServerOptions(config).andThen((serverOptions) =>
    getClientOptions(outputChannel).map(
      (clientOptions) =>
        new LanguageClient(HEADER, 'Roc', serverOptions, clientOptions),
    ),
  );

  return languageClient;
}
