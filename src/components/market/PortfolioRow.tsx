import { memo } from "react";
import { Link } from "react-router-dom";
import { AnimatedNumber } from "./AnimatedNumber";
import type { UserPosition } from "../../config/userConfig";
import { computePortfolioRow } from "../../domain/calculators";
import { useQuote } from "../../realtime/watchlistStore";
import { formatUtcWithMs } from "../../utils/time";

type PortfolioRowProps = {
  position: UserPosition;
};

function PortfolioRowInner({ position }: PortfolioRowProps) {
  const quote = useQuote(position.symbol);
  const qty = Number(position.qty);
  const entryPrice = Number(position.avgCost);
  const markPrice = quote?.lastPrice ?? null;
  const metrics = computePortfolioRow(qty, entryPrice, markPrice);

  return (
    <tr>
      <td>
        <Link to={`/asset/${position.symbol}`}>{position.symbol}</Link>
      </td>
      <td>{qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
      <td>
        <AnimatedNumber value={entryPrice} decimals={4} />
      </td>
      <td>
        <AnimatedNumber
          value={markPrice}
          decimals={2}
          tone={markPrice !== null ? (markPrice >= entryPrice ? "up" : "down") : "flat"}
        />
      </td>
      <td>
        <AnimatedNumber
          value={metrics.positionValue}
          decimals={2}
          tone={metrics.positionValue !== null ? (metrics.positionValue >= metrics.costBasis ? "up" : "down") : "flat"}
        />
      </td>
      <td>
        <AnimatedNumber
          value={metrics.unrealizedPnl}
          decimals={2}
          tone={metrics.unrealizedPnl !== null ? (metrics.unrealizedPnl >= 0 ? "up" : "down") : "flat"}
        />
      </td>
      <td>
        <AnimatedNumber
          value={metrics.roiPct}
          decimals={2}
          tone={metrics.roiPct !== null ? (metrics.roiPct >= 0 ? "up" : "down") : "flat"}
        />
      </td>
      <td className="muted">{quote?.updatedAtMs ? formatUtcWithMs(quote.updatedAtMs) : "--"}</td>
    </tr>
  );
}

export const PortfolioRow = memo(PortfolioRowInner, (a, b) => a.position.id === b.position.id);
