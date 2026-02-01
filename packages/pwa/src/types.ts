// Legacy mode (for backward compatibility)
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

// =============================================================================
// PixelHQ-bridge Protocol Types
// =============================================================================

// Activity states (richer than Mode)
export type Activity = 'thinking' | 'responding' | 'waiting' | 'user_prompt' | 'idle';

// Tool categories
export type ToolCategory =
  | 'FILE_READ'
  | 'FILE_WRITE'
  | 'TERMINAL'
  | 'BROWSER'
  | 'AGENT'
  | 'USER_INPUT'
  | 'OTHER';

// Tool visual effect types
export type ToolEffectType =
  | 'skill'      // Skill invocation - gold sparkle effect
  | 'file_read'  // Reading files - blue document effect
  | 'file_write' // Writing files - green pencil effect
  | 'terminal'   // Running commands - orange terminal pulse
  | 'browser'    // Web operations - cyan globe effect
  | 'agent'      // Sub-agent spawn - purple portal effect
  | 'default';   // Generic tool - gear effect

// Map ToolCategory to visual effect
export const TOOL_EFFECT_MAP: Record<ToolCategory, ToolEffectType> = {
  FILE_READ: 'file_read',
  FILE_WRITE: 'file_write',
  TERMINAL: 'terminal',
  BROWSER: 'browser',
  AGENT: 'agent',
  USER_INPUT: 'default',
  OTHER: 'default',
};

// Token usage tracking
export interface TokenUsage {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

// ---------------------------------------------------------------------------
// PixelEvent discriminated union
// ---------------------------------------------------------------------------

interface BaseEvent {
  id: string;
  sessionId: string;
  timestamp: string;
}

export interface SessionEvent extends BaseEvent {
  type: 'session';
  action: 'started' | 'ended';
  project?: string;
  model?: string;
  source?: string;
}

export interface ActivityEvent extends BaseEvent {
  type: 'activity';
  agentId?: string;
  action: Activity;
  tokens?: TokenUsage;
}

export interface ToolEvent extends BaseEvent {
  type: 'tool';
  agentId?: string;
  tool: ToolCategory;
  detail?: string;
  status: 'started' | 'completed' | 'error';
  toolUseId: string;
  context?: string;
}

export interface AgentEvent extends BaseEvent {
  type: 'agent';
  agentId?: string;
  action: 'spawned' | 'completed' | 'error';
  agentRole?: string;
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  agentId?: string;
  severity: 'warning' | 'error';
}

export interface SummaryEvent extends BaseEvent {
  type: 'summary';
}

export type PixelEvent =
  | SessionEvent
  | ActivityEvent
  | ToolEvent
  | AgentEvent
  | ErrorEvent
  | SummaryEvent;

// ---------------------------------------------------------------------------
// Bridge state
// ---------------------------------------------------------------------------

export interface SessionStateEntry {
  sessionId: string;
  project: string;
  source: string;
  lastEventAt: string;
  agentIds: string[];
  pendingTaskIds: string[];
}

export interface BridgeState {
  sessions: SessionStateEntry[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// WebSocket messages
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { type: 'ping' }
  | { type: 'auth'; token?: string; pairingCode?: string; deviceName?: string }
  | { type: 'subscribe'; sessionId?: string }
  | { type: 'get_state' };

export type ServerMessage =
  | { type: 'welcome'; payload: { message: string; version: string; authRequired: boolean } }
  | { type: 'pong' }
  | { type: 'auth_success'; payload: { token: string } }
  | { type: 'auth_failed'; payload: { reason: string } }
  | { type: 'event'; payload: PixelEvent }
  | { type: 'state'; payload: BridgeState };

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
