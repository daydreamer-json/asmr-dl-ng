const LOG_LEVELS = {
  0: 'fatal',
  1: 'error',
  2: 'warn',
  3: 'info',
  4: 'debug',
  5: 'trace',
} as const;
const LOG_LEVELS_NUM = [0, 1, 2, 3, 4, 5] as const;

type LogLevelNumber = keyof typeof LOG_LEVELS;
type LogLevelString = (typeof LOG_LEVELS)[LogLevelNumber];

export type { LogLevelNumber, LogLevelString };
export { LOG_LEVELS, LOG_LEVELS_NUM };
