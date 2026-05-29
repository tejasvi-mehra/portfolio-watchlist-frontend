import type { ClientEnvelope } from "./protocol";

type MessageHandler = (raw: unknown) => void;
type OpenHandler = () => void;
type CloseHandler = () => void;
type ErrorHandler = () => void;

export class RealtimeWSClient {
  private socket: WebSocket | null = null;
  private readonly url: string;
  private readonly onMessage: MessageHandler;
  private readonly onOpen?: OpenHandler;
  private readonly onClose?: CloseHandler;
  private readonly onError?: ErrorHandler;
  private pendingSends: string[] = [];

  constructor(
    url: string,
    onMessage: MessageHandler,
    callbacks?: { onOpen?: OpenHandler; onClose?: CloseHandler; onError?: ErrorHandler },
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onOpen = callbacks?.onOpen;
    this.onClose = callbacks?.onClose;
    this.onError = callbacks?.onError;
  }

  connect() {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      for (const payload of this.pendingSends) {
        this.socket.send(payload);
      }
      this.pendingSends = [];
      this.onOpen?.();
    };
    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data));
        this.onMessage(parsed);
      } catch {
        // Ignore malformed payloads in MVP scaffold.
      }
    };
    this.socket.onclose = () => {
      this.onClose?.();
    };
    this.socket.onerror = () => {
      this.onError?.();
    };
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.close();
    this.socket = null;
    this.pendingSends = [];
  }

  send<TPayload>(message: ClientEnvelope<TPayload>) {
    const payload = JSON.stringify(message);
    if (!this.socket) return;
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(payload);
      return;
    }
    // Queue sends until onopen so initial subscribe cannot be dropped.
    this.pendingSends.push(payload);
  }
}
