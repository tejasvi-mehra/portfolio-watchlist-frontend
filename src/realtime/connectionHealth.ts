export type ConnectionHealthInput = {
  now: number;
  socketOpen: boolean;
  socketDead: boolean;
  lastTickAtMs: number;
  disconnectedAtMs: number;
  socketOpenedAtMs: number;
  serverHealthyAtMs: number;
  staleAfterMs: number;
};

function withinGrace(now: number, markerMs: number, staleAfterMs: number): boolean {
  return markerMs > 0 && now - markerMs <= staleAfterMs;
}

export function shouldMarkConnectionStale(input: ConnectionHealthInput): boolean {
  if (withinGrace(input.now, input.serverHealthyAtMs, input.staleAfterMs)) {
    return false;
  }
  if (withinGrace(input.now, input.socketOpenedAtMs, input.staleAfterMs)) {
    return false;
  }

  if (input.socketOpen) {
    return input.lastTickAtMs > 0 && input.now - input.lastTickAtMs > input.staleAfterMs;
  }

  return input.disconnectedAtMs > 0 && input.now - input.disconnectedAtMs > input.staleAfterMs;
}

export function shouldPromoteConnectionHealthy(input: ConnectionHealthInput): boolean {
  if (!input.socketOpen) return false;
  if (withinGrace(input.now, input.serverHealthyAtMs, input.staleAfterMs)) {
    return true;
  }
  if (input.lastTickAtMs > 0 && input.now - input.lastTickAtMs <= input.staleAfterMs) {
    return true;
  }
  return withinGrace(input.now, input.socketOpenedAtMs, input.staleAfterMs);
}

export function shouldAcceptServerStale(
  lastTickAtMs: number,
  now: number,
  staleAfterMs: number,
  socketOpenedAtMs = 0,
  serverHealthyAtMs = 0,
): boolean {
  if (withinGrace(now, serverHealthyAtMs, staleAfterMs)) {
    return false;
  }
  if (withinGrace(now, socketOpenedAtMs, staleAfterMs)) {
    return false;
  }
  if (lastTickAtMs <= 0) return true;
  return now - lastTickAtMs > staleAfterMs;
}
