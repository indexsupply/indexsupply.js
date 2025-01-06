export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

type LoggerConfig = {
  logLevel: LogLevel;
  logHandler: (level: LogLevel, message: string, ...args: unknown[]) => void;
};

const defaultConfig: LoggerConfig = {
  logLevel: LogLevel.INFO,
  logHandler: (level, message, ...args) => {
    const levelName = LogLevel[level];
    console.log(`[${levelName}] ${message}`, ...args);
  },
};

let currentConfig: LoggerConfig = { ...defaultConfig };

export const setLogLevel = (level: LogLevel): void => {
  currentConfig.logLevel = level;
};

export const setLogHandler = (
  handler: (level: LogLevel, message: string, ...args: unknown[]) => void
): void => {
  currentConfig.logHandler = handler;
};

export const log = (level: LogLevel, message: string, ...args: unknown[]): void => {
  if (level <= currentConfig.logLevel) {
    currentConfig.logHandler(level, message, ...args);
  }
};

export const error = (message: string, ...args: unknown[]): void => {
  log(LogLevel.ERROR, message, ...args);
};

export const warn = (message: string, ...args: unknown[]): void => {
  log(LogLevel.WARN, message, ...args);
};

export const info = (message: string, ...args: unknown[]): void => {
  log(LogLevel.INFO, message, ...args);
};

export const debug = (message: string, ...args: unknown[]): void => {
  log(LogLevel.DEBUG, message, ...args);
};
