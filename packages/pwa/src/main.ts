import { setupCanvas, clearCanvas } from './engine/canvas';
import { drawOffice } from './scenes/office';
import { drawWorkspace } from './scenes/workspace';
import { WSClient, BridgeClient } from './net/ws';
import { store, loadConnectionInfo, AppState } from './store/state';
import { initSprites } from './engine/spriteManager';
import type { Mode } from './types';

// DOM elements
const pairPrompt = document.getElementById('pair-prompt')!;
const connectionStatus = document.getElementById('connection-status')!;

// State
let wsClient: WSClient | null = null;
let bridgeClient: BridgeClient | null = null;
let currentMode: Mode = 'idle';
let currentState: AppState = store.getState();

// Dev mode: add ?dev to URL to see scene without connection
const isDev = window.location.search.includes('dev');

// Live mode: add ?live to connect to local CLI server
const isLive = window.location.search.includes('live');

// Bridge mode: add ?bridge to connect to PixelHQ-bridge
const isBridge = window.location.search.includes('bridge');

// Scene selection: ?scene=workspace or ?scene=office (default: workspace)
const sceneParam = new URLSearchParams(window.location.search).get('scene');
const useWorkspaceScene = sceneParam !== 'office';

// Initialize
async function init() {
  // Setup canvas
  const { ctx } = setupCanvas('game');

  // Try to load sprites (gracefully falls back to procedural if not found)
  await initSprites();

  // Dev mode: hide prompt and cycle through modes for testing
  if (isDev) {
    pairPrompt.classList.add('hidden');
    const modes: Mode[] = ['idle', 'typing', 'thinking', 'running', 'celebrate', 'error'];
    let modeIndex = 0;

    // Click to cycle modes
    document.addEventListener('click', () => {
      modeIndex = (modeIndex + 1) % modes.length;
      store.setMode(modes[modeIndex]);
      console.log('Mode:', modes[modeIndex]);
    });

    // Keyboard shortcuts for modes
    document.addEventListener('keydown', (e) => {
      const keyMap: Record<string, Mode> = {
        '1': 'idle', '2': 'typing', '3': 'thinking',
        '4': 'running', '5': 'celebrate', '6': 'error'
      };
      if (keyMap[e.key]) {
        store.setMode(keyMap[e.key]);
        console.log('Mode:', keyMap[e.key]);
      }
    });
  }

  // Bridge mode: connect to PixelHQ-bridge
  if (isBridge) {
    pairPrompt.classList.add('hidden');

    // Optional pairing code from URL
    const pairingCode = new URLSearchParams(window.location.search).get('code') || undefined;

    bridgeClient = new BridgeClient(pairingCode);
    bridgeClient.connect();

    console.log('Bridge mode: connecting to PixelHQ-bridge');
  }

  // Live mode: connect directly to local CLI WebSocket
  if (isLive && !isBridge) {
    pairPrompt.classList.add('hidden');

    // Read token from CLI config or use default
    const token = new URLSearchParams(window.location.search).get('token') || '000000';
    const wsEndpoint = `ws://127.0.0.1:8765/ws?token=${token}`;

    const connectionInfo = {
      wsEndpoint,
      token,
      ip: '127.0.0.1'
    };

    store.setConnectionInfo(connectionInfo);
    wsClient = new WSClient(connectionInfo);
    wsClient.connect();

    console.log('Live mode: connecting to', wsEndpoint);
  }

  // Check for connection info
  const connectionInfo = loadConnectionInfo();

  if (connectionInfo) {
    // Hide pair prompt and connect
    pairPrompt.classList.add('hidden');
    store.setConnectionInfo(connectionInfo);

    wsClient = new WSClient(connectionInfo);
    wsClient.connect();
  }

  // Subscribe to state changes
  store.subscribe((state) => {
    currentMode = state.mode;
    currentState = state;

    // Update connection status UI
    updateConnectionStatus(state.connectionState);
  });

  // Start render loop
  requestAnimationFrame(function loop(time) {
    if (useWorkspaceScene) {
      drawWorkspace(ctx, currentState, time);
    } else {
      drawOffice(ctx, currentMode, time);
    }
    requestAnimationFrame(loop);
  });

  // Handle visibility changes (reconnect when app becomes visible)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const state = store.getState();
      if (state.connectionState === 'disconnected') {
        if (bridgeClient) {
          bridgeClient.connect();
        } else if (wsClient) {
          wsClient.connect();
        }
      }
    }
  });
}

function updateConnectionStatus(state: 'disconnected' | 'connecting' | 'connected' | 'authenticated') {
  connectionStatus.classList.remove('hidden', 'connected', 'disconnected');

  if (state === 'connected' || state === 'authenticated') {
    connectionStatus.textContent = state === 'authenticated' ? 'Authenticated' : 'Connected';
    connectionStatus.classList.add('connected');

    // Hide after 2 seconds
    setTimeout(() => {
      connectionStatus.classList.add('hidden');
    }, 2000);
  } else if (state === 'disconnected') {
    connectionStatus.textContent = 'Disconnected - Reconnecting...';
    connectionStatus.classList.add('disconnected');
  } else if (state === 'connecting') {
    connectionStatus.textContent = 'Connecting...';
    connectionStatus.classList.add('disconnected');
  }
}

// Start the app
init().catch(console.error);
