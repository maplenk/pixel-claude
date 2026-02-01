import type {
  Mode,
  ConnectionInfo,
  Activity,
  ToolCategory,
  TokenUsage,
  PixelEvent,
  SessionEvent,
  ActivityEvent,
  ToolEvent,
  AgentEvent,
  ErrorEvent,
} from '../types';

// Connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

// Current tool info
export interface CurrentTool {
  category: ToolCategory;
  detail: string;
  context: string | null;
  status: 'started' | 'completed' | 'error';
  toolUseId: string;
}

// Agent animation state
export type AgentAnimState = 'walking_in' | 'active' | 'walking_out' | 'exited';

// Agent info with animation
export interface AgentInfo {
  agentId: string;
  role: string;
  status: 'running' | 'completed' | 'error';
  // Animation state
  animState: AgentAnimState;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  // Character variety (0-5 for different tints)
  characterIndex: number;
  // Spawn timestamp
  spawnedAt: number;
}

// Session info
export interface SessionInfo {
  sessionId: string;
  project: string;
  model?: string;
}

// Last error
export interface LastError {
  severity: 'warning' | 'error';
  timestamp: string;
}

// Token tracking
export interface TokenTracker {
  totalInput: number;
  totalOutput: number;
  cacheRead: number;
  cacheWrite: number;
}

// Extended AppState for PixelHQ-bridge
export interface AppState {
  // Legacy mode (for backward compatibility)
  mode: Mode;

  // Rich activity state
  activity: Activity;

  // Current tool being used
  currentTool: CurrentTool | null;

  // Active sub-agents
  agents: Map<string, AgentInfo>;

  // Session info
  session: SessionInfo | null;

  // Session timing
  sessionStartTime: number | null;
  estimatedTokenBudget: number;

  // Last error
  lastError: LastError | null;

  // Token usage
  tokens: TokenTracker;

  // Connection
  connectionState: ConnectionState;
  connectionInfo: ConnectionInfo | null;

  // Auth token (from bridge)
  authToken: string | null;
}

type Listener = (state: AppState) => void;

// Counter for assigning unique character indices
let agentCounter = 0;

class Store {
  private state: AppState = {
    mode: 'idle',
    activity: 'idle',
    currentTool: null,
    agents: new Map(),
    session: null,
    sessionStartTime: null,
    estimatedTokenBudget: 100000,
    lastError: null,
    tokens: { totalInput: 0, totalOutput: 0, cacheRead: 0, cacheWrite: 0 },
    connectionState: 'disconnected',
    connectionInfo: null,
    authToken: null,
  };

  private listeners: Set<Listener> = new Set();

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Legacy mode setter (maps activity to mode)
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

  setAuthToken(authToken: string | null): void {
    this.state = { ...this.state, authToken };
    if (authToken) {
      localStorage.setItem('pixelhq_auth_token', authToken);
    } else {
      localStorage.removeItem('pixelhq_auth_token');
    }
    this.notify();
  }

  // Process PixelEvent from bridge
  processEvent(event: PixelEvent): void {
    switch (event.type) {
      case 'session':
        this.handleSessionEvent(event);
        break;
      case 'activity':
        this.handleActivityEvent(event);
        break;
      case 'tool':
        this.handleToolEvent(event);
        break;
      case 'agent':
        this.handleAgentEvent(event);
        break;
      case 'error':
        this.handleErrorEvent(event);
        break;
    }
    this.notify();
  }

  private handleSessionEvent(event: SessionEvent): void {
    if (event.action === 'started') {
      this.state = {
        ...this.state,
        session: {
          sessionId: event.sessionId,
          project: event.project || 'Unknown',
          model: event.model,
        },
        sessionStartTime: Date.now(),
        activity: 'idle',
        mode: 'idle',
        tokens: { totalInput: 0, totalOutput: 0, cacheRead: 0, cacheWrite: 0 },
      };
    } else if (event.action === 'ended') {
      this.state = {
        ...this.state,
        session: null,
        sessionStartTime: null,
        activity: 'idle',
        mode: 'celebrate',
      };
      // Reset after celebration
      setTimeout(() => {
        this.state = { ...this.state, mode: 'idle' };
        this.notify();
      }, 3000);
    }
  }

  private handleActivityEvent(event: ActivityEvent): void {
    const activity = event.action;
    const mode = this.activityToMode(activity);

    // Track tokens
    if (event.tokens) {
      this.state.tokens.totalInput += event.tokens.input;
      this.state.tokens.totalOutput += event.tokens.output;
      if (event.tokens.cacheRead) {
        this.state.tokens.cacheRead += event.tokens.cacheRead;
      }
      if (event.tokens.cacheWrite) {
        this.state.tokens.cacheWrite += event.tokens.cacheWrite;
      }
    }

    this.state = {
      ...this.state,
      activity,
      mode,
    };
  }

  private handleToolEvent(event: ToolEvent): void {
    if (event.status === 'started') {
      this.state = {
        ...this.state,
        currentTool: {
          category: event.tool,
          detail: event.detail || event.tool,
          context: event.context || null,
          status: 'started',
          toolUseId: event.toolUseId,
        },
        mode: this.toolToMode(event.tool),
      };
    } else {
      // completed or error
      if (this.state.currentTool?.toolUseId === event.toolUseId) {
        this.state = {
          ...this.state,
          currentTool: {
            ...this.state.currentTool,
            status: event.status,
          },
          mode: event.status === 'error' ? 'error' : this.state.mode,
        };
        // Clear tool after a delay
        setTimeout(() => {
          if (this.state.currentTool?.toolUseId === event.toolUseId) {
            this.state = { ...this.state, currentTool: null };
            this.notify();
          }
        }, 1000);
      }
    }
  }

  private handleAgentEvent(event: AgentEvent): void {
    const agents = new Map(this.state.agents);

    if (event.action === 'spawned' && event.agentId) {
      // Calculate spawn position (off-screen, alternating left/right)
      const slotIndex = agents.size;
      const enterFromLeft = slotIndex % 2 === 0;
      const startX = enterFromLeft ? -20 : 200; // Off-screen
      const startY = 220; // Bottom area of scene

      // Target position in the workspace
      const targetX = 25 + (slotIndex % 6) * 25;
      const targetY = 200 + (slotIndex % 3) * 8; // Slight Y variation

      agents.set(event.agentId, {
        agentId: event.agentId,
        role: event.agentRole || 'agent',
        status: 'running',
        animState: 'walking_in',
        x: startX,
        y: startY,
        targetX,
        targetY,
        characterIndex: agentCounter % 6,
        spawnedAt: Date.now(),
      });
      agentCounter++;
    } else if ((event.action === 'completed' || event.action === 'error') && event.agentId) {
      const agent = agents.get(event.agentId);
      if (agent) {
        // Start walk-out animation
        const exitX = agent.x < 90 ? -20 : 200; // Exit to nearest edge
        agents.set(event.agentId, {
          ...agent,
          status: event.action === 'completed' ? 'completed' : 'error',
          animState: 'walking_out',
          targetX: exitX,
          targetY: agent.y,
        });
        // Remove agent after walk-out delay
        setTimeout(() => {
          const currentAgents = new Map(this.state.agents);
          currentAgents.delete(event.agentId!);
          this.state = { ...this.state, agents: currentAgents };
          this.notify();
        }, 3000); // Longer delay for walk-out
      }
    }

    this.state = { ...this.state, agents };
  }

  private handleErrorEvent(event: ErrorEvent): void {
    this.state = {
      ...this.state,
      lastError: {
        severity: event.severity,
        timestamp: event.timestamp,
      },
      mode: event.severity === 'error' ? 'error' : this.state.mode,
    };
    // Clear error after delay
    setTimeout(() => {
      this.state = { ...this.state, lastError: null };
      this.notify();
    }, 3000);
  }

  // Map activity to legacy mode
  private activityToMode(activity: Activity): Mode {
    switch (activity) {
      case 'thinking':
        return 'thinking';
      case 'responding':
        return 'typing';
      case 'waiting':
        return 'idle';
      case 'user_prompt':
        return 'idle';
      default:
        return 'idle';
    }
  }

  // Map tool category to legacy mode
  private toolToMode(tool: ToolCategory): Mode {
    switch (tool) {
      case 'FILE_READ':
        return 'thinking';
      case 'FILE_WRITE':
        return 'typing';
      case 'TERMINAL':
        return 'running';
      case 'BROWSER':
        return 'thinking';
      case 'AGENT':
        return 'running';
      default:
        return 'thinking';
    }
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

// Load auth token from localStorage
export function loadAuthToken(): string | null {
  return localStorage.getItem('pixelhq_auth_token');
}

export function clearConnectionInfo(): void {
  localStorage.removeItem('pixelhq_wsEndpoint');
  localStorage.removeItem('pixelhq_token');
  localStorage.removeItem('pixelhq_ip');
  localStorage.removeItem('pixelhq_auth_token');
}
