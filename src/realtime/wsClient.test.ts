import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeWSClient } from "./wsClient";

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CLOSING = 2;
  static CONNECTING = 0;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_url: string) {}

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  send(_data: string) {}
}

describe("RealtimeWSClient", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports dead socket states", () => {
    const client = new RealtimeWSClient("ws://example.test/ws", () => undefined);
    expect(client.isDead()).toBe(true);
    expect(client.isOpen()).toBe(false);
  });

  it("reconnect replaces a dead socket without duplicate close callbacks", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const client = new RealtimeWSClient("ws://example.test/ws", () => undefined, { onOpen, onClose });
    client.connect();
    client.send({ version: 1, type: "resume", payload: { last_seen_seq: 5 } });
    const socket = (client as unknown as { socket: MockWebSocket }).socket;
    socket.readyState = MockWebSocket.CLOSED;
    expect(client.isDead()).toBe(true);
    client.reconnect();
    expect(onClose).not.toHaveBeenCalled();
    expect(client.isDead()).toBe(false);
    expect((client as unknown as { pendingSends: string[] }).pendingSends).toEqual([]);
  });
});
