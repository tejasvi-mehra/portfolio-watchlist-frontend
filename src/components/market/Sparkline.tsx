import { useEffect, useMemo, useRef, useState } from "react";
import { CHART_CANDLE_GAP, CHART_CANDLE_WIDTH, MARK_PRICE_DECIMALS, roundMarkPrice } from "../../config/chart";
import { formatUtcWithMs } from "../../utils/time";

type PricePoint = {
  price: number;
  timestampMs: number;
};

type SparklineProps = {
  points: PricePoint[];
  width?: number;
  height?: number;
  color?: string;
};

function computeChartBounds(prices: number[]) {
  const rounded = prices.map(roundMarkPrice);
  const minRaw = Math.min(...rounded);
  const maxRaw = Math.max(...rounded);
  const last = rounded[rounded.length - 1];
  const tick = 10 ** -MARK_PRICE_DECIMALS;

  if (maxRaw - minRaw < tick) {
    const pad = Math.max(last * 0.0005, tick * 4);
    return { min: last - pad, max: last + pad, isFlat: true, last };
  }

  const span = maxRaw - minRaw;
  const pad = Math.max(span * 0.08, tick);
  return { min: minRaw - pad, max: maxRaw + pad, isFlat: false, last };
}

export function Sparkline({ points, width = 320, height = 96, color = "#8ab4ff" }: SparklineProps) {
  if (!points || points.length < 2) {
    return <div className="muted">Not enough data for chart yet.</div>;
  }

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(Math.max(width, 320));

  const bounds = useMemo(() => computeChartBounds(points.map((item) => item.price)), [points]);
  const { min, max, isFlat } = bounds;
  const range = max - min || 1;
  const candleBodyWidth = CHART_CANDLE_WIDTH;
  const candleGap = CHART_CANDLE_GAP;
  const slotWidth = candleBodyWidth + candleGap;
  const chartWidth = Math.max(viewportWidth, points.length * slotWidth + 48);
  const stepX = slotWidth;

  const priceY = (price: number) => {
    const rounded = roundMarkPrice(price);
    if (isFlat) return height / 2;
    return height - ((rounded - min) / range) * height;
  };

  const plotted = useMemo(
    () =>
      points.map((point, idx) => {
        const x = idx * stepX + 16;
        const y = priceY(point.price);
        const prev = idx > 0 ? points[idx - 1].price : point.price;
        const prevY = priceY(prev);
        const open = roundMarkPrice(prev);
        const close = roundMarkPrice(point.price);
        const high = Math.max(open, close);
        const low = Math.min(open, close);
        const highY = priceY(high);
        const lowY = priceY(low);
        return { ...point, price: close, x, y, prevY, open, close, highY, lowY };
      }),
    [height, isFlat, min, points, range, stepX],
  );

  const hovered = hoveredIndex !== null ? plotted[hoveredIndex] : null;
  const formatPrice = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: MARK_PRICE_DECIMALS,
      maximumFractionDigits: MARK_PRICE_DECIMALS,
    });
  const formatTime = (timestampMs: number) => formatUtcWithMs(timestampMs);
  const gridValues = isFlat
    ? [bounds.last]
    : [0, 0.25, 0.5, 0.75, 1].map((r) => min + r * range);
  const rightAxisX = chartWidth - 56;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewportWidth(Math.max(320, el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.scrollLeft = el.scrollWidth;
    return () => observer.disconnect();
  }, [points.length]);

  return (
    <div className="sparkline-wrap">
      <div className="sparkline-scroll" ref={scrollRef}>
        <svg viewBox={`0 0 ${chartWidth} ${height}`} className="sparkline" role="img" aria-label="Price candlestick chart">
          {gridValues.map((value, idx) => {
            const y = isFlat ? height / 2 : height - ((value - min) / range) * height;
            return (
              <g key={`grid-${idx}`}>
                <line x1={0} y1={y} x2={chartWidth} y2={y} className="sparkline-grid" />
                <text x={rightAxisX} y={y - 2} className="sparkline-axis-label">
                  {formatPrice(value)}
                </text>
              </g>
            );
          })}
          {plotted.map((point, idx) => {
            const candleColor = point.close >= point.open ? "#69d191" : "#ef8f8f";
            const bodyTop = Math.min(point.prevY, point.y);
            const bodyHeight = isFlat ? 2 : Math.max(2, Math.abs(point.prevY - point.y));
            return (
              <g
                key={`pt-${idx}`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex((prev) => (prev === idx ? null : prev))}
              >
                <line x1={point.x} y1={point.highY} x2={point.x} y2={point.lowY} stroke={candleColor} strokeWidth={1.2} />
                <rect x={point.x - candleBodyWidth / 2} y={bodyTop} width={candleBodyWidth} height={bodyHeight} fill={candleColor} />
              </g>
            );
          })}
        </svg>
      </div>
      {hovered ? (
        <div className="sparkline-tooltip">
          <div>Price: {formatPrice(hovered.price)}</div>
          <div>Time: {formatTime(hovered.timestampMs)}</div>
        </div>
      ) : null}
      <div className="sparkline-axis-row">
        <span className="muted">Price Axis (UTC): {formatPrice(isFlat ? bounds.last : min)}</span>
        <span className="muted">{formatPrice(isFlat ? bounds.last : max)}</span>
      </div>
      <div className="sparkline-axis-row">
        <span className="muted">Time Axis (UTC): {formatTime(points[0].timestampMs)}</span>
        <span className="muted">{formatTime(points[points.length - 1].timestampMs)}</span>
      </div>
    </div>
  );
}
