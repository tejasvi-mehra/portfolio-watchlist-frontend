export type UserPosition = {
  id: string;
  symbol: string;
  qty: string;
  avgCost: string;
};

const WATCHLIST_STORAGE_KEY = "axis.watchlist.symbols";
const PORTFOLIO_STORAGE_KEY = "axis.portfolio.positions";
const CONFIG_UPDATED_EVENT = "axis-config-updated";

const DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL"];
const DEFAULT_POSITIONS: UserPosition[] = [
  { id: "p1", symbol: "BTC", qty: "0.5", avgCost: "62000" },
  { id: "p2", symbol: "ETH", qty: "3", avgCost: "2800" },
];

export function loadWatchlistSymbols(): string[] {
  const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
  if (!raw) return DEFAULT_SYMBOLS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_SYMBOLS;
    const normalized = parsed
      .map((item) => String(item).trim().toUpperCase())
      .filter((item) => /^[A-Z0-9#._-]{2,20}$/.test(item));
    return normalized.length > 0 ? Array.from(new Set(normalized)) : DEFAULT_SYMBOLS;
  } catch {
    return DEFAULT_SYMBOLS;
  }
}

export function loadPortfolioPositions(): UserPosition[] {
  const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
  if (!raw) return DEFAULT_POSITIONS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_POSITIONS;
    const normalized = parsed
      .map((item, idx) => {
        const asObj = item as Partial<UserPosition>;
        return {
          id: String(asObj.id || `loaded-${idx}`),
          symbol: String(asObj.symbol || "").trim().toUpperCase(),
          qty: String(asObj.qty || "").trim(),
          avgCost: String(asObj.avgCost || "").trim(),
        };
      })
      .filter(
        (item) =>
          /^[A-Z0-9#._-]{2,20}$/.test(item.symbol) &&
          Number(item.qty) > 0 &&
          Number(item.avgCost) >= 0,
      );
    return normalized.length > 0 ? normalized : DEFAULT_POSITIONS;
  } catch {
    return DEFAULT_POSITIONS;
  }
}

export function saveUserConfig(symbols: string[], positions: UserPosition[]) {
  const portfolioSymbols = positions.map((item) => item.symbol.trim().toUpperCase()).filter((item) => item !== "");
  const mergedWatchlist = Array.from(
    new Set(
      [...symbols, ...portfolioSymbols]
        .map((item) => item.trim().toUpperCase())
        .filter((item) => /^[A-Z0-9#._-]{2,20}$/.test(item)),
    ),
  );
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(mergedWatchlist));
  localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(positions));
  window.dispatchEvent(new Event(CONFIG_UPDATED_EVENT));
}

export function subscribeUserConfigUpdates(onUpdate: () => void): () => void {
  const storageHandler = (event: StorageEvent) => {
    if (!event.key || event.key === WATCHLIST_STORAGE_KEY || event.key === PORTFOLIO_STORAGE_KEY) {
      onUpdate();
    }
  };
  const localHandler = () => onUpdate();
  window.addEventListener("storage", storageHandler);
  window.addEventListener(CONFIG_UPDATED_EVENT, localHandler);
  return () => {
    window.removeEventListener("storage", storageHandler);
    window.removeEventListener(CONFIG_UPDATED_EVENT, localHandler);
  };
}

