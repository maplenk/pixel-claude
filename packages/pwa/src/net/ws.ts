import type { Mode, ConnectionInfo, ServerMessage, PixelEvent, ClientMessage } from '../types';
import { store, loadAuthToken } from '../store/state';

type StateHandler = (mode: Mode) => void;
type EventHandler = (event: PixelEvent) => void;

// Bridge WebSocket endpoint
const BRIDGE_WS_URL = 'ws://localhost:8765';

export class BridgeClient {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimeout: number | null = null;
  private eventHandlers: Set<EventHandler> = new Set();
  private shouldReconnect = true;
  private pairingCode: string | null = null;
  private pingInterval: number | null = null;

  constructor(pairingCode?: string) {
    this.pairingCode = pairingCode || null;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.shouldReconnect = true;
    store.setConnectionState('connecting');

    try {
      this.ws = new WebSocket(BRIDGE_WS_URL);

      this.ws.onopen = () => {
        console.log('[Bridge] Connected');
        this.reconnectDelay = 1000;
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('[Bridge] Failed to parse message:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[Bridge] Disconnected:', event.code, event.reason);
        store.setConnectionState('disconnected');
        this.ws = null;
        this.stopPing();

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Bridge] Error:', error);
      };
    } catch (err) {
      console.error('[Bridge] Failed to connect:', err);
      store.setConnectionState('disconnected');
      this.scheduleReconnect();
    }
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        console.log('[Bridge] Welcome:', message.payload.message);
        store.setConnectionState('connected');
        // Authenticate
        this.authenticate();
        break;

      case 'auth_success':
        console.log('[Bridge] Authenticated');
        store.setConnectionState('authenticated');
        store.setAuthToken(message.payload.token);
        // Subscribe to all sessions
        this.subscribe();
        break;

      case 'auth_failed':
        console.error('[Bridge] Auth failed:', message.payload.reason);
        store.setConnectionState('connected');
        // Clear stored token
        store.setAuthToken(null);
        break;

      case 'event':
        // Process the PixelEvent
        store.processEvent(message.payload);
        // Notify handlers
        for (const handler of this.eventHandlers) {
          handler(message.payload);
        }
        break;

      case 'state':
        console.log('[Bridge] State:', message.payload.sessions.length, 'sessions');
        break;

      case 'pong':
        // Heartbeat received
        break;
    }
  }

  private authenticate(): void {
    const savedToken = loadAuthToken();

    const authMessage: ClientMessage = {
      type: 'auth',
      deviceName: 'PixelHQ PWA',
    };

    if (savedToken) {
      authMessage.token = savedToken;
    } else if (this.pairingCode) {
      authMessage.pairingCode = this.pairingCode;
    }

    this.send(authMessage);
  }

  private subscribe(): void {
    // Subscribe to all sessions
    this.send({ type: 'subscribe' });
    // Get current state
    this.send({ type: 'get_state' });
  }

  private startPing(): void {
    this.pingInterval = window.setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  setPairingCode(code: string): void {
    this.pairingCode = code;
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    console.log(`[Bridge] Reconnecting in ${this.reconnectDelay}ms...`);

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

// Legacy WSClient for backward compatibility with hook-based system
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
        this.reconnectDelay = 1000;

        this.ws?.send(JSON.stringify({
          type: 'hello',
          version: 1,
          client: 'pwa',
          token: this.connectionInfo.token,
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
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

    this.reconnectDelay = Math.min(
      this.reconnectDelay * 1.5,
      this.maxReconnectDelay
    );
  }
}
