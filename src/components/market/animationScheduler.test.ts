import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetAnimationSchedulerForTests,
  animationSubscriberCount,
  notifyAnimationTargetChanged,
  registerAnimationSubscriber,
} from "./animationScheduler";

describe("animationScheduler", () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafId = 0;

  beforeEach(() => {
    __resetAnimationSchedulerForTests();
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal("window", {
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        rafId += 1;
        return rafId;
      },
      cancelAnimationFrame: () => undefined,
    });
  });

  afterEach(() => {
    __resetAnimationSchedulerForTests();
    vi.unstubAllGlobals();
  });

  it("registers one shared animation loop for multiple subscribers", () => {
    const displayA = { value: 100 };
    const displayB = { value: 200 };

    const unregisterA = registerAnimationSubscriber({
      getTarget: () => 110,
      getDisplay: () => displayA.value,
      setDisplay: (next) => {
        displayA.value = next ?? 0;
      },
    });
    registerAnimationSubscriber({
      getTarget: () => 210,
      getDisplay: () => displayB.value,
      setDisplay: (next) => {
        displayB.value = next ?? 0;
      },
    });

    expect(animationSubscriberCount()).toBe(2);
    expect(rafCallbacks).toHaveLength(1);

    rafCallbacks[0]?.(0);
    expect(displayA.value).toBeCloseTo(103.5, 5);
    expect(displayB.value).toBeCloseTo(203.5, 5);

    unregisterA();
    expect(animationSubscriberCount()).toBe(1);
  });

  it("restarts the loop when a target changes while idle", () => {
    const display = { value: 100 };
    const target = { value: 100 };

    registerAnimationSubscriber({
      getTarget: () => target.value,
      getDisplay: () => display.value,
      setDisplay: (next) => {
        display.value = next ?? 0;
      },
    });

    rafCallbacks[0]?.(0);
    expect(display.value).toBe(100);
    expect(rafCallbacks).toHaveLength(1);

    target.value = 110;
    notifyAnimationTargetChanged();
    expect(rafCallbacks).toHaveLength(2);
  });
});
