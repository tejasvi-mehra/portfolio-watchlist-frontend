import { describe, expect, it } from "vitest";
import { shouldAcceptServerStale, shouldMarkConnectionStale, shouldPromoteConnectionHealthy } from "./connectionHealth";

describe("connectionHealth", () => {
  it("marks stale when socket is dead beyond threshold", () => {
    expect(
      shouldMarkConnectionStale({
        now: 10_000,
        socketOpen: false,
        socketDead: true,
        lastTickAtMs: 0,
        disconnectedAtMs: 3_000,
        socketOpenedAtMs: 0,
        serverHealthyAtMs: 0,
        staleAfterMs: 6_000,
      }),
    ).toBe(true);
  });

  it("does not mark stale while reconnecting inside threshold", () => {
    expect(
      shouldMarkConnectionStale({
        now: 8_000,
        socketOpen: false,
        socketDead: true,
        lastTickAtMs: 0,
        disconnectedAtMs: 3_000,
        socketOpenedAtMs: 0,
        serverHealthyAtMs: 0,
        staleAfterMs: 6_000,
      }),
    ).toBe(false);
  });

  it("does not mark stale while connecting using old tick timestamps", () => {
    expect(
      shouldMarkConnectionStale({
        now: 20_000,
        socketOpen: false,
        socketDead: false,
        lastTickAtMs: 1_000,
        disconnectedAtMs: 18_000,
        socketOpenedAtMs: 0,
        serverHealthyAtMs: 0,
        staleAfterMs: 6_000,
      }),
    ).toBe(false);
  });

  it("marks stale when open socket has no ticks beyond threshold", () => {
    expect(
      shouldMarkConnectionStale({
        now: 20_000,
        socketOpen: true,
        socketDead: false,
        lastTickAtMs: 10_000,
        disconnectedAtMs: 0,
        socketOpenedAtMs: 10_000,
        serverHealthyAtMs: 0,
        staleAfterMs: 6_000,
      }),
    ).toBe(true);
  });

  it("does not mark stale when server recently reported healthy", () => {
    expect(
      shouldMarkConnectionStale({
        now: 20_000,
        socketOpen: true,
        socketDead: false,
        lastTickAtMs: 1_000,
        disconnectedAtMs: 0,
        socketOpenedAtMs: 1_000,
        serverHealthyAtMs: 19_000,
        staleAfterMs: 6_000,
      }),
    ).toBe(false);
  });

  it("promotes healthy state after server recovery signal", () => {
    expect(
      shouldPromoteConnectionHealthy({
        now: 12_000,
        socketOpen: true,
        socketDead: false,
        lastTickAtMs: 1_000,
        disconnectedAtMs: 0,
        socketOpenedAtMs: 1_000,
        serverHealthyAtMs: 11_500,
        staleAfterMs: 6_000,
      }),
    ).toBe(true);
  });

  it("promotes healthy state after reconnect grace window", () => {
    expect(
      shouldPromoteConnectionHealthy({
        now: 12_000,
        socketOpen: true,
        socketDead: false,
        lastTickAtMs: 0,
        disconnectedAtMs: 0,
        socketOpenedAtMs: 11_000,
        serverHealthyAtMs: 0,
        staleAfterMs: 6_000,
      }),
    ).toBe(true);
  });

  it("ignores server stale when local ticks are fresh", () => {
    expect(shouldAcceptServerStale(9_500, 10_000, 6_000, 0, 0)).toBe(false);
    expect(shouldAcceptServerStale(3_000, 10_000, 6_000, 0, 0)).toBe(true);
  });

  it("ignores server stale immediately after server recovery signal", () => {
    expect(shouldAcceptServerStale(1_000, 12_000, 6_000, 1_000, 11_500)).toBe(false);
  });
});
