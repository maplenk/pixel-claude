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

// Dev mode: add ?dev to URL to see scene without connection
const isDev = window.location.search.includes('dev');

// Live mode: add ?live to connect to local CLI server
const isLive = window.location.search.includes('live');

// Initialize
async function init() {
  // Setup canvas
  const { ctx } = setupCanvas('game');

  // Dev mode: hide prompt and cycle through modes for testing
  if (isDev) {
    pairPrompt.classList.add('hidden');
    const modes: Mode[] = ['idle', 'typing', 'thinking', 'running', 'celebrate', 'error'];
    let modeIndex = 0;

    // Click to cycle modes
    document.addEventListener('click', () => {
      modeIndex = (modeIndex + 1) % modes.length;
      currentMode = modes[modeIndex];
      console.log('Mode:', currentMode);
    });

    // Keyboard shortcuts for modes
    document.addEventListener('keydown', (e) => {
      const keyMap: Record<string, Mode> = {
        '1': 'idle', '2': 'typing', '3': 'thinking',
        '4': 'running', '5': 'celebrate', '6': 'error'
      };
      if (keyMap[e.key]) {
        currentMode = keyMap[e.key];
        console.log('Mode:', currentMode);
      }
    });
  }

  // Live mode: connect directly to local CLI WebSocket
  if (isLive) {
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

// Start the app
init().catch(console.error);
