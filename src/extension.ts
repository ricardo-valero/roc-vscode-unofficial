import * as vscode from 'vscode';
import * as ConfigReader from './config-reader';
import * as LanguageClientResult from './language-client';
import * as OutputChannel from './output-channel';
import { COMMANDS } from './constants';
import { LanguageClient } from 'vscode-languageclient/node';
import { None, Option } from 'ts-results';
import * as util from './util';

let maybeClient: Option<LanguageClient> = None;

const manage =
  <A, B>(maybeObj: Option<A>, promise: (obj: A) => Promise<B>) =>
  (onSuccess: () => B, onError: (e: unknown) => void) =>
    maybeObj.map((obj) => promise(obj).then(onSuccess).catch(onError));

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const outputChannel = OutputChannel.create(context);
  const log = util.logger(outputChannel.appendLine, {
    info: OutputChannel.outputFormatter('Info'),
    error: OutputChannel.outputFormatter('Error'),
    warn: OutputChannel.outputFormatter('Warn'),
  });
  const show = {
    info: vscode.window.showInformationMessage,
    error: vscode.window.showErrorMessage,
    warn: vscode.window.showWarningMessage,
  };
  const configReader = ConfigReader.api(log);
  const languageClientResult = LanguageClientResult.create(
    outputChannel,
    configReader,
  );

  if (languageClientResult.err) {
    log.error("Roc language server won't start, there's no path set.");
    await show.error("Roc language server won't start, there's no path set.");
  } else {
    maybeClient = languageClientResult.toOption();

    context.subscriptions.push(
      vscode.commands.registerCommand(
        COMMANDS.languageServerStart.command,
        () => {
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: COMMANDS.languageServerStart.title,
              cancellable: true,
            },
            (_prog, token) => {
              return new Promise<void>((res, rej) => {
                token.onCancellationRequested(rej);
                return manage(maybeClient, (client) => client.start())(
                  () => {
                    log.info('Language client started.');
                    return res;
                  },
                  (e) => {
                    log.error(`Language client failed to start: ${String(e)}.`);
                    return rej(e);
                  },
                );
              });
            },
          );
        },
      ),

      vscode.commands.registerCommand(
        COMMANDS.languageServerStop.command,
        () => {
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: COMMANDS.languageServerStop.title,
              cancellable: true,
            },
            (_prog, token) => {
              return new Promise<void>((res, rej) => {
                token.onCancellationRequested(rej);
                return manage(maybeClient, (client) => client.stop())(
                  () => {
                    log.info('Language client stopped.');
                    return res;
                  },
                  (e) => {
                    log.error(`Language client failed to stop: ${String(e)}.`);
                    return rej(e);
                  },
                );
              });
            },
          );
        },
      ),

      vscode.commands.registerCommand(
        COMMANDS.languageServerRestart.command,
        () => {
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: COMMANDS.languageServerRestart.title,
              cancellable: true,
            },
            (_prog, token) => {
              return new Promise<void>((res, rej) => {
                token.onCancellationRequested(rej);
                return manage(maybeClient, (client) => client.restart())(
                  () => {
                    log.info('Language client restarted.');
                    return res;
                  },
                  (e) => {
                    log.error(
                      `Language client failed to restart: ${String(e)}.`,
                    );
                    return rej(e);
                  },
                );
              });
            },
          );
        },
      ),
    );
    await vscode.commands.executeCommand(COMMANDS.languageServerStart.command);
  }
}

export async function deactivate(): Promise<void> {
  await vscode.commands.executeCommand(COMMANDS.languageServerStop.command);
}
