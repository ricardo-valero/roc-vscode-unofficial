import {
  Cause,
  Context,
  Effect,
  LogLevel,
  Logger,
  Match,
  Option,
  Runtime,
  Scope,
  Stream,
  SubscriptionRef,
} from 'effect';
import { FunctionN } from 'effect/Function';
import * as vscode from 'vscode';

export class ExtensionContext extends Context.Tag('vscode/ExtensionContext')<
  ExtensionContext,
  vscode.ExtensionContext
>() {}

export const logger = (name: string) =>
  Logger.replaceScoped(
    Logger.defaultLogger,
    Effect.gen(function* (_) {
      const channel = yield* _(
        Effect.acquireRelease(
          Effect.sync(() =>
            vscode.window.createOutputChannel(name, { log: true }),
          ),
          (channel) => Effect.sync(() => channel.dispose()),
        ),
      );
      return Logger.make((options) => {
        const message = Logger.logfmtLogger.log(options);
        return Match.value(options.logLevel).pipe(
          Match.when(LogLevel.Trace, () => channel.trace),
          Match.when(LogLevel.Debug, () => channel.debug),
          Match.when(LogLevel.Warning, () => channel.warn),
          Match.when(LogLevel.Error, () => channel.error),
          Match.when(LogLevel.Fatal, () => channel.error),
          Match.orElse(() => channel.info),
        )(message);
      });
    }),
  );

export const thenable = <A>(
  f: FunctionN<[], Thenable<A>>,
): Effect.Effect<A, never, never> =>
  Effect.async<A>((resume) => {
    f().then((a) => resume(Effect.succeed(a)));
  });

export const dismissable = <A>(
  f: FunctionN<[], Thenable<A>>,
): Effect.Effect<A, Cause.NoSuchElementException> =>
  thenable(f).pipe(Effect.flatMap(Effect.fromNullable));

export const executeCommand = (command: string, ...args: Array<unknown>) =>
  thenable(() => vscode.commands.executeCommand(command, ...args));

export const registerCommand = <A, E, R>(
  command: string,
  f: FunctionN<Array<unknown>, Effect.Effect<A, E, R>>,
) =>
  Effect.gen(function* (_) {
    const context = yield* _(ExtensionContext);
    const runtime = yield* _(Effect.runtime<R>());
    const run = Runtime.runFork(runtime);
    context.subscriptions.push(
      vscode.commands.registerCommand(command, (...args) =>
        f(...args).pipe(
          Effect.catchAllCause(Effect.log),
          Effect.annotateLogs({ command }),
          run,
        ),
      ),
    );
  });

export const runWithToken = <R>(runtime: Runtime.Runtime<R>) => {
  const runCallback = Runtime.runCallback(runtime);
  return <E, A>(token: vscode.CancellationToken) =>
    (effect: Effect.Effect<A, E, R>) =>
      new Promise<A | undefined>((resolve) => {
        const cancel = runCallback(effect, {
          onExit: (exit) => {
            d.dispose();
            if (exit._tag === 'Success') {
              resolve(exit.value);
            } else {
              resolve(undefined);
            }
          },
        });
        const d = token.onCancellationRequested(() => {
          cancel();
        });
      });
};

export const listen = <A, R>(
  event: vscode.Event<A>,
  f: (data: A) => Effect.Effect<void, never, R>,
): Effect.Effect<never, never, R> =>
  Effect.flatMap(Effect.runtime<R>(), (runtime) =>
    Effect.async<never>((_resume) => {
      const run = Runtime.runFork(runtime);
      const d = event((data) =>
        run(
          Effect.catchAllCause(f(data), (_) =>
            Effect.log('unhandled defect in event listener', _),
          ),
        ),
      );
      return Effect.sync(() => {
        d.dispose();
      });
    }),
  );

export const listenStream = <A>(event: vscode.Event<A>): Stream.Stream<A> =>
  Stream.async<A>((emit) => {
    const d = event((data) => emit.single(data));
    return Effect.sync(() => {
      d.dispose();
    });
  });

export const listenFork = <A, R>(
  event: vscode.Event<A>,
  f: (data: A) => Effect.Effect<void, never, R>,
) => Effect.forkScoped(listen(event, f));

export interface ConfigRef<A> {
  readonly get: Effect.Effect<A>;
  readonly changes: Stream.Stream<A>;
}

export const configWithDefault = <A>(
  namespace: string,
  setting: string,
  defaultValue: A,
): Effect.Effect<ConfigRef<A>, never, Scope.Scope> =>
  Effect.gen(function* (_) {
    const get = () =>
      vscode.workspace.getConfiguration(namespace).get<A>(setting);
    const ref = yield* _(SubscriptionRef.make(get() ?? defaultValue));
    yield* _(
      listenFork(vscode.workspace.onDidChangeConfiguration, (_) =>
        SubscriptionRef.set(ref, get() ?? defaultValue),
      ),
    );
    return {
      get: SubscriptionRef.get(ref),
      changes: Stream.changes(ref.changes),
    };
  });

export const withProgress = <A, E, R>(
  options: vscode.ProgressOptions,
  effect: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* (_) {
    const runtime = yield* _(Effect.runtime<R>());
    const run = runWithToken(runtime);
    yield* thenable(() =>
      vscode.window.withProgress(options, (_, token) =>
        effect.pipe(
          Effect.catchAllCause(Effect.log),
          Effect.annotateLogs({ title: options.title }),
          run(token),
        ),
      ),
    );
  });
