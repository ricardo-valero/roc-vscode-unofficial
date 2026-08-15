import {
  Cause,
  Context,
  Data,
  Effect,
  FiberHandle,
  Layer,
  Option,
  Stream,
  SubscriptionRef,
} from 'effect';
import { COMMANDS } from '../constants';
import {
  ConfigRef,
  configWithDefault,
  executeCommand,
  registerCommand,
  withProgress,
} from './vscode';
import * as vscode from 'vscode';
import {
  CloseAction,
  ErrorAction,
  Executable,
  LanguageClient,
  TransportKind,
} from 'vscode-languageclient/node';

class LanguageClientError extends Data.TaggedError(
  'vscode/LanguageClientError',
)<{
  type: 'start' | 'stop' | 'restart';
  message: string;
}> {}

export class LanguageClientState extends Data.TaggedClass(
  'LanguageClientState',
)<{
  readonly running: boolean;
  readonly cause: Cause.Cause<LanguageClientError>;
  readonly settings: {
    run: ConfigRef<string>;
    debug: ConfigRef<string>;
  };
}> {}

export class LanguageClientContext extends Context.Tag(
  'effect-vscode/LanguageClient/LanguageClientContext',
)<
  LanguageClientContext,
  {
    readonly client: SubscriptionRef.SubscriptionRef<
      Option.Option<LanguageClient>
    >;
    readonly running: SubscriptionRef.SubscriptionRef<LanguageClientState>;
    readonly run: ConfigRef<string>;
    readonly debug: ConfigRef<string>;
  }
>() {
  static readonly Live = Layer.scoped(
    LanguageClientContext,
    Effect.gen(function* (_) {
      const client = yield* _(
        SubscriptionRef.make(Option.none<LanguageClient>()),
      );
      const run = yield* _(
        configWithDefault<string>(
          'roc',
          'language-server.exe',
          'roc_language_server',
        ),
      );
      const debug = yield* _(
        configWithDefault<string>(
          'roc',
          'language-server.debug-exe',
          'roc_language_server',
        ),
      );
      const running = yield* _(
        SubscriptionRef.make(
          new LanguageClientState({
            running: false,
            cause: Cause.empty,
            run: yield* _(run.get),
          }),
        ),
      );
      return LanguageClientContext.of({
        running,
        client,
        run,
        debug,
      });
    }),
  );
}

const runServer = Effect.gen(function* (_) {
  const { client, running, settings } = yield* _(LanguageClientContext);

  const makeClient = () =>
    Effect.gen(function* (_) {
      const settingsSub = yield* _(settings.get);
      const serverOptions = {
        run: {
          command: yield* _(settingsSub.run.get),
          transport: TransportKind.stdio,
        },
        debug: {
          command: yield* _(settingsSub.debug.get),
          transport: TransportKind.stdio,
        },
      };
      const languageClient = new LanguageClient('roc', serverOptions, {
        documentSelector: [{ language: 'roc', scheme: 'file' }],
        progressOnInitialization: true,
        errorHandler: {
          closed: () => ({
            action: CloseAction.DoNotRestart,
          }),
          error: () => ({
            action: ErrorAction.Shutdown,
          }),
        },
      });
      yield* _(
        Effect.acquireRelease(
          SubscriptionRef.update(settings, languageClient),
          () => SubscriptionRef.update(settings, languageClient),
        ),
      );
      yield* _(
        Effect.acquireRelease(
          SubscriptionRef.update(
            client,
            Option.orElseSome(() => languageClient),
          ),
          () =>
            SubscriptionRef.update(
              client,
              Option.filter((_) => _ !== languageClient),
            ),
        ),
      );
      const clientHandle = yield* FiberHandle.make();
      yield* _(
        settings.changes,
        Stream.runForEach((settings) =>
          Effect.gen(function* (_) {
            yield* settings
              ? FiberHandle.run(clientHandle, run, { onlyIfMissing: true })
              : FiberHandle.clear(clientHandle);
            yield* executeCommand('roc.language-server.start', running);
          }),
        ),
      );
    }).pipe(Effect.scoped);

  const run = makeClient.pipe(
    Effect.catchAllCause((cause) =>
      SubscriptionRef.update(
        running,
        (_) => new LanguageClientState({ ..._, running: false, cause }),
      ),
    ),
  );

  const serverHandle = yield* FiberHandle.make();
  yield* _(
    running.changes,
    Stream.runForEach(({ running }) =>
      Effect.gen(function* (_) {
        yield* running
          ? FiberHandle.run(serverHandle, run, { onlyIfMissing: true })
          : FiberHandle.clear(serverHandle);
        yield* executeCommand('setContext', 'effect:running', running);
      }),
    ),
  );
}).pipe(Effect.scoped);

const startClient = Effect.gen(function* () {
  const languageClient = yield* getLanguageClient;
  yield* Effect.tryPromise({
    try: () => languageClient.start(),
    catch: (error) =>
      new LanguageClientError({
        type: 'start',
        message: `${error}`,
      }),
  });
});

const stopClient = Effect.gen(function* () {
  const languageClient = yield* getLanguageClient;
  yield* Effect.tryPromise({
    try: () => languageClient.stop(),
    catch: (error) =>
      new LanguageClientError({
        type: 'stop',
        message: `${error}`,
      }),
  });
});

const startClientCommand = registerCommand(
  COMMANDS.languageServerStart.command,
  () =>
    withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: COMMANDS.languageServerStart.title,
        cancellable: true,
      },
      startClient,
    ),
);
