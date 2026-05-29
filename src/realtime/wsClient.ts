import type { ClientEnvelope } from "./protocol";
import { logger } from "../utils/logger";

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
  private receivedCount = 0;
  private readonly receivedByType: Record<string, number> = {};

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
    logger.info("ws connecting", { url: this.url });
    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      const queuedCount = this.pendingSends.length;
      for (const payload of this.pendingSends) {
        this.socket.send(payload);
      }
      this.pendingSends = [];
      logger.info("ws connected", { queued_messages_flushed: queuedCount });
      this.onOpen?.();
    };
    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data));
        this.receivedCount += 1;
        const msgType = String((parsed as { type?: unknown })?.type || "unknown");
        this.receivedByType[msgType] = (this.receivedByType[msgType] || 0) + 1;
        logger.debug("ws packet received", parsed);
        if (this.receivedCount === 1 || this.receivedCount % 50 === 0) {
          logger.info("ws response counts", {
            total: this.receivedCount,
            by_type: this.receivedByType,
          });
        }
        this.onMessage(parsed);
      } catch {
        logger.error("ws message parse failed");
      }
    };
    this.socket.onclose = () => {
      logger.info("ws closed", { total_messages_received: this.receivedCount });
      this.onClose?.();
    };
    this.socket.onerror = () => {
      logger.error("ws error");
      this.onError?.();
    };
  }

  disconnect() {
    if (!this.socket) return;
    logger.info("ws disconnect requested");
    this.socket.close();
    this.socket = null;
    this.pendingSends = [];
  }

  send<TPayload>(message: ClientEnvelope<TPayload>) {
    const payload = JSON.stringify(message);
    if (!this.socket) {
      // Queue early sends made before connect() allocates the websocket.
      this.pendingSends.push(payload);
      logger.debug("ws packet queued (no socket yet)", { type: message.type, queue_size: this.pendingSends.length });
      return;
    }
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(payload);
      logger.debug("ws packet sent", message);
      return;
    }
    // Queue sends until onopen so initial subscribe cannot be dropped.
    this.pendingSends.push(payload);
    logger.debug("ws packet queued", { type: message.type, queue_size: this.pendingSends.length });
  }
}
