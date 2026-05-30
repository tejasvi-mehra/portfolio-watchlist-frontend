import { lerpDisplay } from "./AnimatedNumber";

export type AnimationSubscriber = {
  getTarget: () => number | null;
  getDisplay: () => number | null;
  setDisplay: (value: number | null) => void;
};

const subscribers = new Set<AnimationSubscriber>();
let rafId: number | null = null;

function stepSubscriber(subscriber: AnimationSubscriber): boolean {
  const target = subscriber.getTarget();
  const current = subscriber.getDisplay();

  if (target === null || !Number.isFinite(target)) {
    if (current !== null) {
      subscriber.setDisplay(null);
      return true;
    }
    return false;
  }

  if (current === null || !Number.isFinite(current)) {
    if (current !== target) {
      subscriber.setDisplay(target);
      return true;
    }
    return false;
  }

  const next = lerpDisplay(current, target);
  if (next !== current) {
    subscriber.setDisplay(next);
    return true;
  }

  return false;
}

function subscriberNeedsFrame(subscriber: AnimationSubscriber): boolean {
  const target = subscriber.getTarget();
  const current = subscriber.getDisplay();
  if (target === null || !Number.isFinite(target)) {
    return current !== null;
  }
  if (current === null || !Number.isFinite(current)) {
    return true;
  }
  return target !== current;
}

function tick(): void {
  for (const subscriber of subscribers) {
    stepSubscriber(subscriber);
  }

  if (subscribers.size > 0 && [...subscribers].some(subscriberNeedsFrame)) {
    rafId = window.requestAnimationFrame(tick);
  } else {
    rafId = null;
  }
}

function ensureRunning(): void {
  if (subscribers.size === 0) return;
  if (rafId !== null) return;
  rafId = window.requestAnimationFrame(tick);
}

export function registerAnimationSubscriber(subscriber: AnimationSubscriber): () => void {
  subscribers.add(subscriber);
  ensureRunning();
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0 && rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

export function notifyAnimationTargetChanged(): void {
  ensureRunning();
}

export function animationSubscriberCount(): number {
  return subscribers.size;
}

export function __resetAnimationSchedulerForTests(): void {
  if (rafId !== null && typeof window !== "undefined") {
    window.cancelAnimationFrame(rafId);
  }
  subscribers.clear();
  rafId = null;
}
