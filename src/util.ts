export type Fn<A extends unknown[], B> = (...args: A) => B;

export function objectMap<T extends Record<string, unknown>, U>(
  object: T,
  transformFn: Fn<[T[keyof T]], U>,
): { [K in keyof T]: U } {
  const result: { [K in keyof T]: U } = {} as { [K in keyof T]: U };
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      result[key] = transformFn(object[key]);
    }
  }
  return result satisfies { [K in keyof T]: U };
}

export const getEnv = <T>(obj: T) => ({
  get: (key: keyof T) => obj[key],
});

export function logger<X>(
  logFn: Fn<[message: string], X>,
  formatters: {
    info: Fn<[message: string], string>;
    error: Fn<[message: string], string>;
    warn: Fn<[message: string], string>;
  },
) {
  return {
    info: (message: string) => logFn(formatters.info(message)),
    error: (message: string) => logFn(formatters.error(message)),
    warn: (message: string) => logFn(formatters.warn(message)),
  };
}
