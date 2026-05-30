import { env } from "../config/env";

type LogLevel = "debug" | "info" | "error";

const rank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  error: 30,
};

function shouldLog(level: LogLevel): boolean {
  return rank[level] >= rank[env.logLevel];
}

function prefix(message: string): string {
  return `[portfolio-watchlist-frontend] ${message}`;
}

export const logger = {
  debug(message: string, meta?: unknown) {
    if (!shouldLog("debug")) return;
    if (meta !== undefined) {
      console.debug(prefix(message), meta);
      return;
    }
    console.debug(prefix(message));
  },
  info(message: string, meta?: unknown) {
    if (!shouldLog("info")) return;
    if (meta !== undefined) {
      console.info(prefix(message), meta);
      return;
    }
    console.info(prefix(message));
  },
  error(message: string, meta?: unknown) {
    if (!shouldLog("error")) return;
    if (meta !== undefined) {
      console.error(prefix(message), meta);
      return;
    }
    console.error(prefix(message));
  },
};
