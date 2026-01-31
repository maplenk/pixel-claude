import { setupCanvas, clearCanvas } from './engine/canvas';
import { drawOffice } from './scenes/office';
import { WSClient } from './net/ws';
import { store, loadConnectionInfo } from './store/state';
import type { Mode } from './types';

// DOM elements
const pairPrompt = document.getElementById('pair-prompt')!;
const connectionStatus = document.getElementById('connection-status')!;

// State
let wsClient: WSClient | null = null;
let currentMode: Mode = 'idle';

// Initialize
async function init() {
  // Setup canvas
  const { ctx } = setupCanvas('game');

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

    // Update connection status UI
    updateConnectionStatus(state.connectionState);
  });

  // Start render loop
  requestAnimationFrame(function loop(time) {
    drawOffice(ctx, currentMode, time);
    requestAnimationFrame(loop);
  });

  // Handle visibility changes (reconnect when app becomes visible)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wsClient) {
      const state = store.getState();
      if (state.connectionState === 'disconnected') {
        wsClient.connect();
      }
    }
  });
}

function updateConnectionStatus(state: 'disconnected' | 'connecting' | 'connected') {
  connectionStatus.classList.remove('hidden', 'connected', 'disconnected');

  if (state === 'connected') {
    connectionStatus.textContent = 'Connected';
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

// Keyboard shortcuts for testing (1-6 for modes)
document.addEventListener('keydown', (e) => {
  const modeMap: Record<string, Mode> = {
    '1': 'idle',
    '2': 'typing',
    '3': 'running',
    '4': 'thinking',
    '5': 'celebrate',
    '6': 'error',
  };

  if (modeMap[e.key]) {
    currentMode = modeMap[e.key];
    console.log(`Mode: ${currentMode}`);
  }
});

// Start the app
init().catch(console.error);
