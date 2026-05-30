import { describe, expect, it } from "vitest";
import { directionFromDelta, lerpDisplay } from "./AnimatedNumber";

describe("AnimatedNumber helpers", () => {
  it("derives direction from target delta", () => {
    expect(directionFromDelta(100, 101)).toBe("up");
    expect(directionFromDelta(101, 100)).toBe("down");
    expect(directionFromDelta(100, 100)).toBe("flat");
    expect(directionFromDelta(null, 100)).toBe("flat");
  });

  it("lerps display toward target and snaps near epsilon", () => {
    expect(lerpDisplay(100, 110)).toBeCloseTo(103.5, 5);
    expect(lerpDisplay(100, 100.005)).toBe(100.005);
  });
});
