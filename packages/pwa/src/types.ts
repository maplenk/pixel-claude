export type Mode = 'idle' | 'typing' | 'running' | 'thinking' | 'celebrate' | 'error';

export interface StateMessage {
  type: 'state';
  mode: Mode;
  ts: number;
}

export interface ConnectionInfo {
  wsEndpoint: string;
  token: string;
  ip: string;
}

export interface ArtConfig {
  tileSize: number;
  internalWidth: number;
  internalHeight: number;
}

export const ART_CONFIG: ArtConfig = {
  tileSize: 16,
  internalWidth: 180,   // Portrait mode
  internalHeight: 320,
};
