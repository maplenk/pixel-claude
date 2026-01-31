export type Mode = 'idle' | 'typing' | 'running' | 'thinking' | 'celebrate' | 'error';

export interface StateMessage {
  type: 'state';
  mode: Mode;
  ts: number;
}

export interface HelloMessage {
  type: 'hello';
  version: number;
  client: string;
  token: string;
}

export interface HookEvent {
  type: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Error';
  tool?: string;
  exitCode?: number;
}

export type ClientMessage = HelloMessage;
export type ServerMessage = StateMessage;
