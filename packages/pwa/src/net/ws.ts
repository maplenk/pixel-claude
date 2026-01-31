import type { Mode, StateMessage, ConnectionInfo } from '../types';
import { store } from '../store/state';

type StateHandler = (mode: Mode) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private connectionInfo: ConnectionInfo;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimeout: number | null = null;
  private stateHandlers: Set<StateHandler> = new Set();
  private shouldReconnect = true;

  constructor(connectionInfo: ConnectionInfo) {
    this.connectionInfo = connectionInfo;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.shouldReconnect = true;
    store.setConnectionState('connecting');

    try {
      this.ws = new WebSocket(this.connectionInfo.wsEndpoint);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        store.setConnectionState('connected');
        this.reconnectDelay = 1000; // Reset delay on successful connection

        // Send hello message
        this.ws?.send(JSON.stringify({
          type: 'hello',
          version: 1,
          client: 'pwa',
          token: this.connectionInfo.token,
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message: StateMessage = JSON.parse(event.data);
          if (message.type === 'state') {
            store.setMode(message.mode);
            for (const handler of this.stateHandlers) {
              handler(message.mode);
            }
          }
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        store.setConnectionState('disconnected');
        this.ws = null;

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (err) {
      console.error('[WS] Failed to connect:', err);
      store.setConnectionState('disconnected');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onState(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms...`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 1.5,
      this.maxReconnectDelay
    );
  }
}
