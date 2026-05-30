const enabled = import.meta.env.DEV;

export function markPerf(name: string) {
  if (!enabled || typeof performance === "undefined" || typeof performance.mark !== "function") {
    return;
  }
  performance.mark(name);
}

export function measurePerf(name: string, startMark: string, endMark: string) {
  if (!enabled || typeof performance === "undefined" || typeof performance.measure !== "function") {
    return;
  }
  try {
    performance.measure(name, startMark, endMark);
  } catch {
    // Ignore missing marks when devtools is closed or marks were cleared.
  }
}
