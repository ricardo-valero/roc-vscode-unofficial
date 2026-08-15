import { None, Option, Some } from 'ts-results';
import * as vscode from 'vscode';
import { SETTINGS } from './constants';
import * as util from './util';

function convertUnknownToString(val: unknown): Option<string> {
  if (typeof val !== 'string' || val === '') {
    return None;
  }
  return Some(val);
}

function optionOr<T>(opt: Option<T>, fallback: Option<T>): Option<T> {
  if (opt.some) {
    return opt;
  }
  return fallback;
}

export type Api = ReturnType<typeof api>;

// Move out process.env and vscode.workspace.getConfiguration() to reinvoke it
export function api(logger: ReturnType<typeof util.logger>) {
  const getConfigKey = vscode.workspace.getConfiguration().get;
  const getEnvKey = util.getEnv(process.env).get;
  const log = logger;

  return {
    load: () =>
      util.objectMap(SETTINGS, (key) => {
        const option = optionOr(
          convertUnknownToString(getConfigKey(key.config)),
          convertUnknownToString(getEnvKey(key.env)),
        );
        if (option.some) {
          log.info(`${key.name}: ${option.val}.`);
        } else {
          log.warn(`${key.name} was not defined.`);
        }
        return option;
      }),
  };
}
