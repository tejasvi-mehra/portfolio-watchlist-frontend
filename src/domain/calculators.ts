import type { Position, Quote } from "./types";

// MVP placeholder intentionally uses number conversion for UI-level estimation.
// Financial-grade exact decimal logic can be added with a decimal library later.
export function computeUnrealizedPnl(position: Position, quote: Quote): number {
  const qty = Number(position.qty);
  const avg = Number(position.avgCost);
  const last = Number(quote.lastPrice);
  return (last - avg) * qty;
}
