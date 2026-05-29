import { useEffect, useMemo, useRef, useState } from "react";

type Direction = "up" | "down" | "flat";

type AnimatedNumberProps = {
  value: number | null;
  decimals?: number;
  tone?: "up" | "down" | "flat";
};

export function AnimatedNumber({ value, decimals = 2, tone }: AnimatedNumberProps) {
  const prevRef = useRef<number | null>(null);
  const [direction, setDirection] = useState<Direction>("flat");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev !== null && value !== null) {
      if (value > prev) setDirection("up");
      else if (value < prev) setDirection("down");
      else setDirection("flat");
      if (value !== prev) {
        setFlash(true);
        const timer = window.setTimeout(() => setFlash(false), 220);
        return () => window.clearTimeout(timer);
      }
    }
    prevRef.current = value;
    return undefined;
  }, [value]);

  const formatted = useMemo(() => {
    if (value === null || !Number.isFinite(value)) return "--";
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }, [decimals, value]);

  const effectiveDirection = tone || direction;
  const className = `num ${effectiveDirection !== "flat" ? `num-${effectiveDirection}` : ""} ${flash ? "num-flash" : ""}`;
  return <span className={className}>{formatted}</span>;
}

