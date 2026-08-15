// This should be the same as the package.json #contributes section

export const HEADER = 'roc';

export const SETTINGS = {
  languageServerRun: {
    config: 'roc.language-server.exe',
    env: 'ROC_LSP_PATH',
    name: 'Roc language server exe path',
  },
  languageServerDebug: {
    config: 'roc.language-server.debug-exe',
    env: 'ROC_LSP_DEBUG_PATH',
    name: 'Roc language server debug exe path',
  },
} as const;

export const COMMANDS = {
  languageServerStart: {
    command: 'roc.language-server.start',
    title: 'Start Language Server',
  },
  languageServerStop: {
    command: 'roc.language-server.stop',
    title: 'Stop Language Server',
  },
  languageServerRestart: {
    command: 'roc.language-server.restart',
    title: 'Restart Language Server',
  },
} as const;
