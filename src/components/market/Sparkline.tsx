import { useEffect, useMemo, useRef, useState } from "react";
import { CHART_CANDLE_GAP, CHART_CANDLE_WIDTH } from "../../config/chart";
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

export function Sparkline({ points, width = 320, height = 96, color = "#8ab4ff" }: SparklineProps) {
  if (!points || points.length < 2) {
    return <div className="muted">Not enough data for chart yet.</div>;
  }

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(Math.max(width, 320));
  const prices = points.map((item) => item.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const candleBodyWidth = CHART_CANDLE_WIDTH;
  const candleGap = CHART_CANDLE_GAP;
  const slotWidth = candleBodyWidth + candleGap;
  const chartWidth = Math.max(viewportWidth, points.length * slotWidth + 48);
  const stepX = slotWidth;

  const plotted = useMemo(
    () =>
      points.map((point, idx) => {
        const x = idx * stepX + 16;
        const y = height - ((point.price - min) / range) * height;
        const prev = idx > 0 ? points[idx - 1].price : point.price;
        const prevY = height - ((prev - min) / range) * height;
        const open = prev;
        const close = point.price;
        const high = Math.max(open, close);
        const low = Math.min(open, close);
        const highY = height - ((high - min) / range) * height;
        const lowY = height - ((low - min) / range) * height;
        return { ...point, x, y, prevY, open, close, highY, lowY };
      }),
    [height, min, points, range, stepX],
  );

  const hovered = hoveredIndex !== null ? plotted[hoveredIndex] : null;
  const formatPrice = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const formatTime = (timestampMs: number) => formatUtcWithMs(timestampMs);
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((r) => max - r * range);
  const rightAxisX = chartWidth - 56;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewportWidth(Math.max(320, el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    // Keep latest candles in view similarly to exchange UIs.
    el.scrollLeft = el.scrollWidth;
    return () => observer.disconnect();
  }, [points.length]);

  return (
    <div className="sparkline-wrap">
      <div className="sparkline-scroll" ref={scrollRef}>
        <svg viewBox={`0 0 ${chartWidth} ${height}`} className="sparkline" role="img" aria-label="Price candlestick chart">
          {gridValues.map((value, idx) => {
            const y = height - ((value - min) / range) * height;
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
            const bodyHeight = Math.max(2, Math.abs(point.prevY - point.y));
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
        <span className="muted">Price Axis (UTC): {formatPrice(min)}</span>
        <span className="muted">{formatPrice(max)}</span>
      </div>
      <div className="sparkline-axis-row">
        <span className="muted">Time Axis (UTC): {formatTime(points[0].timestampMs)}</span>
        <span className="muted">{formatTime(points[points.length - 1].timestampMs)}</span>
      </div>
    </div>
  );
}

