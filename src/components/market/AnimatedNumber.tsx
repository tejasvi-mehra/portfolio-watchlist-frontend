import { useEffect, useMemo, useRef, useState } from "react";
import { notifyAnimationTargetChanged, registerAnimationSubscriber } from "./animationScheduler";

type Direction = "up" | "down" | "flat";

type AnimatedNumberProps = {
  value: number | null;
  decimals?: number;
  tone?: "up" | "down" | "flat";
};

const LERP = 0.35;
const SNAP_EPSILON = 0.01;
const FLASH_MS = 220;

export function directionFromDelta(prev: number | null, next: number | null): Direction {
  if (prev === null || next === null || !Number.isFinite(prev) || !Number.isFinite(next)) {
    return "flat";
  }
  if (next > prev) return "up";
  if (next < prev) return "down";
  return "flat";
}

export function lerpDisplay(current: number, target: number, factor = LERP, epsilon = SNAP_EPSILON): number {
  const diff = target - current;
  if (Math.abs(diff) < epsilon) return target;
  return current + diff * factor;
}

export function AnimatedNumber({ value, decimals = 2, tone }: AnimatedNumberProps) {
  const targetRef = useRef<number | null>(value);
  const prevTargetRef = useRef<number | null>(value);
  const displayRef = useRef<number | null>(value);
  const flashTimerRef = useRef<number | null>(null);

  const [display, setDisplay] = useState<number | null>(value);
  const [direction, setDirection] = useState<Direction>("flat");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    const prevTarget = prevTargetRef.current;
    targetRef.current = value;

    setDirection(directionFromDelta(prevTarget, value));

    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }

    const targetChanged =
      prevTarget !== null &&
      value !== null &&
      Number.isFinite(prevTarget) &&
      Number.isFinite(value) &&
      value !== prevTarget;

    if (targetChanged) {
      setFlash(true);
      flashTimerRef.current = window.setTimeout(() => {
        setFlash(false);
        flashTimerRef.current = null;
      }, FLASH_MS);
    }

    prevTargetRef.current = value;

    if (value === null || !Number.isFinite(value)) {
      displayRef.current = null;
      setDisplay(null);
    } else {
      notifyAnimationTargetChanged();
    }
  }, [value]);

  useEffect(() => {
    const unregister = registerAnimationSubscriber({
      getTarget: () => targetRef.current,
      getDisplay: () => displayRef.current,
      setDisplay: (next) => {
        displayRef.current = next;
        setDisplay(next);
      },
    });

    return () => {
      unregister();
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
    };
  }, []);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [decimals],
  );

  const formatted = useMemo(() => {
    if (display === null || !Number.isFinite(display)) return "--";
    return formatter.format(display);
  }, [display, formatter]);

  const effectiveDirection = tone || direction;
  const className = `num ${effectiveDirection !== "flat" ? `num-${effectiveDirection}` : ""} ${flash ? "num-flash" : ""}`;
  return <span className={className}>{formatted}</span>;
}
