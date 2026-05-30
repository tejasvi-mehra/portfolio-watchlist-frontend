function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Hard cap for retained points per symbol.
export const CHART_MAX_POINTS = num(import.meta.env.VITE_CHART_MAX_POINTS as string | undefined, 120);

// Visual candle geometry (Binance-like fixed width/gap behavior).
export const CHART_CANDLE_WIDTH = num(import.meta.env.VITE_CHART_CANDLE_WIDTH as string | undefined, 8);
export const CHART_CANDLE_GAP = num(import.meta.env.VITE_CHART_CANDLE_GAP as string | undefined, 6);

// Mark/chart prices share the same display precision so axis labels match UI mark price.
export const MARK_PRICE_DECIMALS = 2;

export function roundMarkPrice(price: number): number {
  const factor = 10 ** MARK_PRICE_DECIMALS;
  return Math.round(price * factor) / factor;
}
