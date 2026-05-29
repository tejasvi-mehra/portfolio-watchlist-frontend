const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const logLevelRaw = import.meta.env.VITE_LOG_LEVEL as string | undefined;
// Do not hard-crash the UI when env is missing during early local setup.
// Fallback keeps the app visible while still allowing backend connection attempts.
const resolvedWsUrl = wsUrl && wsUrl.trim() !== "" ? wsUrl : "ws://localhost:8081/ws";
const resolvedApiBaseUrl =
  apiBaseUrl && apiBaseUrl.trim() !== "" ? apiBaseUrl.replace(/\/+$/, "") : "http://localhost:8080";
const normalizedLogLevel = (logLevelRaw || "info").trim().toLowerCase();
const resolvedLogLevel =
  normalizedLogLevel === "debug" || normalizedLogLevel === "info" || normalizedLogLevel === "error"
    ? normalizedLogLevel
    : "info";

export const env = {
  appName: (import.meta.env.VITE_APP_NAME as string | undefined) || "Portfolio Watcher",
  wsUrl: resolvedWsUrl,
  apiBaseUrl: resolvedApiBaseUrl,
  logLevel: resolvedLogLevel as "debug" | "info" | "error",
};
