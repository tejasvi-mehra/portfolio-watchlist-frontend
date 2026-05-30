import { memo } from "react";
import { Link } from "react-router-dom";
import { AnimatedNumber } from "./AnimatedNumber";
import { computeDayChangePct } from "../../domain/calculators";
import { useQuote } from "../../realtime/watchlistStore";
import { formatUtcWithMs } from "../../utils/time";

export type WatchlistRowProps = {
  symbol: string;
  openPrice: number | null;
};

function WatchlistRowInner({ symbol, openPrice }: WatchlistRowProps) {
  const quote = useQuote(symbol);
  const lastPrice = quote?.lastPrice ?? null;
  const dayChangePct = computeDayChangePct(lastPrice, openPrice);
  const updatedAtMs = quote?.updatedAtMs ?? null;
  const tone =
    lastPrice !== null && openPrice !== null ? (lastPrice >= openPrice ? "up" : "down") : "flat";

  return (
    <tr>
      <td>
        <Link to={`/asset/${symbol}`}>{symbol}</Link>
      </td>
      <td>
        <AnimatedNumber value={lastPrice} decimals={2} tone={tone} />
      </td>
      <td>
        <AnimatedNumber value={openPrice} decimals={2} />
      </td>
      <td>
        <AnimatedNumber value={dayChangePct} decimals={2} tone={tone} />
      </td>
      <td className="muted">{updatedAtMs ? formatUtcWithMs(updatedAtMs) : "--"}</td>
    </tr>
  );
}

function propsEqual(a: WatchlistRowProps, b: WatchlistRowProps): boolean {
  return a.symbol === b.symbol && a.openPrice === b.openPrice;
}

export const WatchlistRow = memo(WatchlistRowInner, propsEqual);
