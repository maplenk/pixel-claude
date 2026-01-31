import type { Mode, ConnectionInfo } from '../types';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface AppState {
  mode: Mode;
  connectionState: ConnectionState;
  connectionInfo: ConnectionInfo | null;
}

type Listener = (state: AppState) => void;

class Store {
  private state: AppState = {
    mode: 'idle',
    connectionState: 'disconnected',
    connectionInfo: null,
  };

  private listeners: Set<Listener> = new Set();

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setMode(mode: Mode): void {
    this.state = { ...this.state, mode };
    this.notify();
  }

  setConnectionState(connectionState: ConnectionState): void {
    this.state = { ...this.state, connectionState };
    this.notify();
  }

  setConnectionInfo(connectionInfo: ConnectionInfo | null): void {
    this.state = { ...this.state, connectionInfo };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const store = new Store();

// Load connection info from localStorage
export function loadConnectionInfo(): ConnectionInfo | null {
  const wsEndpoint = localStorage.getItem('pixelhq_wsEndpoint');
  const token = localStorage.getItem('pixelhq_token');
  const ip = localStorage.getItem('pixelhq_ip');

  if (wsEndpoint && token && ip) {
    return { wsEndpoint, token, ip };
  }
  return null;
}

export function clearConnectionInfo(): void {
  localStorage.removeItem('pixelhq_wsEndpoint');
  localStorage.removeItem('pixelhq_token');
  localStorage.removeItem('pixelhq_ip');
}
