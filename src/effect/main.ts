import {
  Config,
  ConfigProvider,
  Context,
  Data,
  Effect,
  Layer,
  LogLevel,
  Logger,
  Match,
} from 'effect';
import * as vscode from 'vscode';
import { COMMANDS, SETTINGS } from '../constants';
import {
  CloseAction,
  ErrorAction,
  LanguageClientOptions,
} from 'vscode-languageclient';
import {
  Executable,
  LanguageClient,
  TransportKind,
} from 'vscode-languageclient/node';

const getServerSettings = Effect.gen(function* () {
  const run: Executable = {
    command: yield* Config.string(SETTINGS.languageServerRun.config).pipe(
      Config.orElse(() => Config.string(SETTINGS.languageServerRun.env)),
    ),
    transport: TransportKind.stdio,
  };
  const debug: Executable = {
    command: yield* Config.string(SETTINGS.languageServerDebug.config).pipe(
      Config.orElse(() => Config.string(SETTINGS.languageServerDebug.env)),
    ),
    transport: TransportKind.stdio,
  };
  return { run, debug };
});

const createServerSettingsLayer = Effect.gen(function* () {
  const configProvider = ConfigProvider.fromMap(
    new Map(
      Object.entries(
        // {'roc.language-server.exe': 'roc_language_server' },
        vscode.workspace.getConfiguration(),
      ),
    ),
  );
  const envProvider = ConfigProvider.fromEnv();
  return Layer.setConfigProvider(
    configProvider.pipe(ConfigProvider.orElse(() => envProvider)),
  );
});

class OutputChannel extends Context.Tag('OutputChannel')<
  OutputChannel,
  vscode.OutputChannel
>() {}

const getClientOptions: Effect.Effect<
  LanguageClientOptions,
  never,
  OutputChannel
> = Effect.gen(function* () {
  const outputChannel = yield* OutputChannel;
  return {
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
  } satisfies LanguageClientOptions;
});

const getLanguageClient = Effect.gen(function* () {
  const serverSettings = yield* getServerSettings;
  const clientOptions = yield* getClientOptions;
  return new LanguageClient('roc', 'Roc', serverSettings, clientOptions);
});

const createOutput = Effect.gen(function* () {
  const outputChannel = yield* OutputChannel;
  return Logger.make(({ logLevel, date, message }) =>
    outputChannel.appendLine(`[${logLevel.label} - ${date}] ${message}`),
  );
});

class Notifier extends Context.Tag('Notifier')<
  Notifier,
  {
    info: (message: string) => Effect.Effect<string | undefined, never, never>;
    warn: (message: string) => Effect.Effect<string | undefined, never, never>;
    error: (message: string) => Effect.Effect<string | undefined, never, never>;
  }
>() {}

const provideNotifier = Effect.provideService(Notifier, {
  info: (message: string) =>
    Effect.promise(() => vscode.window.showInformationMessage(message)),
  warn: (message: string) =>
    Effect.promise(() => vscode.window.showInformationMessage(message)),
  error: (message: string) =>
    Effect.promise(() => vscode.window.showErrorMessage(message)),
});

const createNotifier = Effect.gen(function* () {
  const notifier = yield* Notifier;
  const x = yield* notifier.warn('hello');
  return Logger.make((options) => {
    const message = `${options.message}\n[${options.date}]`;
    return Match.value(options.logLevel).pipe(
      Match.when(LogLevel.Warning, () => notifier.warn(message)),
      Match.when(LogLevel.Error, () => notifier.error(message)),
      Match.orElse(() => notifier.info(message)),
    );
  });
});

class CommandError extends Data.TaggedError('CommandError')<{
  type: 'register';
  message: string;
}> {}

class WindowError extends Data.TaggedError('WindowError')<{
  type: 'withProgress';
  message: string;
}> {}

// const withProgress = <S, E, C>(
//   options: vscode.ProgressOptions,
//   task: Effect.Effect<S, E, C>,
// ) =>
//   Effect.gen(function* () {
//     yield* Effect.tryPromise({
//       try: () =>
//         vscode.window.withProgress(options, (_, token) => {
//           const abortController = tokenToController(token);
//           return Effect.runPromise(task as any, {
//             signal: abortController.signal,
//           });
//         }),
//       catch: (error) =>
//         new WindowError({ type: 'withProgress', message: `${error}` }),
//     });
//   });

// const withProgress2 = <T>(options: vscode.ProgressOptions, task: T) =>
//   Effect.async<void>((resume) =>
//     resume(
//       Effect.succeed(
//         vscode.window.withProgress(options, (_, token) =>
//           Effect.async<void>((r) => {
//             token.onCancellationRequested(() => r(Effect.interrupt));
//             r(Effect.succeed(task));
//           }).pipe(Effect.runPromise),
//         ),
//       ),
//     ),
//   );

// const tokenToController = (token: vscode.CancellationToken) => {
//   const controller = new AbortController();
//   token.onCancellationRequested((e) => controller.abort(e));
//   return controller;
// };
