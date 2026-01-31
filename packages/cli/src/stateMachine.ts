import type { Mode, StateMessage } from './types.js';

export type StateChangeHandler = (message: StateMessage) => void;

export class StateMachine {
  private currentMode: Mode = 'idle';
  private lastEventTime: number = Date.now();
  private modeTTL: number | null = null;
  private modeExpiresAt: number | null = null;
  private tickInterval: NodeJS.Timeout | null = null;
  private onChangeHandlers: StateChangeHandler[] = [];

  // Timeouts in ms
  private readonly thinkingTimeout = 3000;  // 3s no events -> thinking
  private readonly idleTimeout = 25000;     // 25s no events -> idle
  private readonly tickRate = 500;          // Check every 500ms

  constructor() {
    this.startTicking();
  }

  get mode(): Mode {
    return this.currentMode;
  }

  onChange(handler: StateChangeHandler): void {
    this.onChangeHandlers.push(handler);
  }

  emit(mode: Mode, ttl?: number): void {
    this.lastEventTime = Date.now();

    if (ttl) {
      this.modeTTL = ttl;
      this.modeExpiresAt = Date.now() + ttl;
    } else {
      this.modeTTL = null;
      this.modeExpiresAt = null;
    }

    if (mode !== this.currentMode) {
      this.currentMode = mode;
      this.broadcast();
    }
  }

  private broadcast(): void {
    const message: StateMessage = {
      type: 'state',
      mode: this.currentMode,
      ts: Date.now(),
    };

    for (const handler of this.onChangeHandlers) {
      handler(message);
    }
  }

  private startTicking(): void {
    this.tickInterval = setInterval(() => this.tick(), this.tickRate);
  }

  private tick(): void {
    const now = Date.now();
    const timeSinceLastEvent = now - this.lastEventTime;

    // Check if mode TTL expired
    if (this.modeExpiresAt && now >= this.modeExpiresAt) {
      this.modeExpiresAt = null;
      this.modeTTL = null;
      // Fall back to idle or thinking based on time
    }

    // Don't override celebrate or error states while they're active
    if (this.currentMode === 'celebrate' || this.currentMode === 'error') {
      if (this.modeExpiresAt && now < this.modeExpiresAt) {
        return;
      }
    }

    // Time-based transitions
    if (timeSinceLastEvent >= this.idleTimeout) {
      if (this.currentMode !== 'idle') {
        this.currentMode = 'idle';
        this.broadcast();
      }
    } else if (timeSinceLastEvent >= this.thinkingTimeout) {
      if (this.currentMode !== 'thinking' && this.currentMode !== 'idle') {
        this.currentMode = 'thinking';
        this.broadcast();
      }
    }
  }

  destroy(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
