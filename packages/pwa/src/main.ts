import { setupCanvas, clearCanvas } from './engine/canvas';
import { drawOffice } from './scenes/office';
import { WSClient } from './net/ws';
import { store, loadConnectionInfo } from './store/state';
import type { Mode } from './types';

// DOM elements
const pairPrompt = document.getElementById('pair-prompt')!;
const connectionStatus = document.getElementById('connection-status')!;
const connectForm = document.getElementById('connect-form') as HTMLFormElement | null;
const serverIpInput = document.getElementById('server-ip') as HTMLInputElement | null;

// State
let wsClient: WSClient | null = null;
let currentMode: Mode = 'idle';
let lastNotifiedMode: Mode | null = null;

async function connectToServer(ip: string): Promise<void> {
  try {
    // Fetch connection info (including token) from the server
    const res = await fetch(`http://${ip}:8787/api/connect`);
    const info = await res.json();
    const connectionInfo = { wsEndpoint: info.wsEndpoint, token: info.token, ip };

    localStorage.setItem('pixelhq_wsEndpoint', info.wsEndpoint);
    localStorage.setItem('pixelhq_token', info.token);
    localStorage.setItem('pixelhq_ip', ip);

    pairPrompt.classList.add('hidden');
    store.setConnectionInfo(connectionInfo);

    if (wsClient) wsClient.disconnect();
    wsClient = new WSClient(connectionInfo);
    wsClient.connect();
  } catch (err) {
    console.error('Failed to connect:', err);
    alert(`Can't reach server at ${ip}:8787. Make sure the CLI is running.`);
  }
}

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
  } else {
    // Show pair prompt with connect form
    pairPrompt.classList.remove('hidden');
  }

  // Handle manual IP connect form
  if (connectForm && serverIpInput) {
    connectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const ip = serverIpInput.value.trim();
      if (ip) connectToServer(ip);
    });
  }

  // Request notification permission on first user interaction
  const requestNotifPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    document.removeEventListener('touchstart', requestNotifPermission);
    document.removeEventListener('click', requestNotifPermission);
  };
  document.addEventListener('touchstart', requestNotifPermission, { once: true });
  document.addEventListener('click', requestNotifPermission, { once: true });

  // Subscribe to state changes
  store.subscribe((state) => {
    currentMode = state.mode;

    // Send notification when input is needed
    if (state.mode === 'input_needed' && lastNotifiedMode !== 'input_needed') {
      sendInputNotification();
    }
    lastNotifiedMode = state.mode;

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

function sendInputNotification(): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  // Only notify when app is not focused
  if (document.visibilityState === 'visible') {
    return;
  }

  new Notification('PixelHQ', {
    body: 'Claude needs your input!',
    icon: '/icons/icon-192.png',
    tag: 'input-needed',
  } as NotificationOptions);
}

// Keyboard shortcuts for testing (1-7 for modes)
const modes: Mode[] = ['idle', 'typing', 'running', 'thinking', 'celebrate', 'error', 'input_needed'];
document.addEventListener('keydown', (e) => {
  const modeMap: Record<string, Mode> = {
    '1': 'idle',
    '2': 'typing',
    '3': 'running',
    '4': 'thinking',
    '5': 'celebrate',
    '6': 'error',
    '7': 'input_needed',
  };

  if (modeMap[e.key]) {
    currentMode = modeMap[e.key];
    store.setMode(currentMode);
    console.log(`Mode: ${currentMode}`);
  }
});

// Two-finger double-tap to cycle modes (mobile testing)
let tapCount = 0;
let tapTimer: ReturnType<typeof setTimeout> | null = null;
document.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 2) return;
  tapCount++;
  if (tapTimer) clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 500);
  if (tapCount >= 2) {
    tapCount = 0;
    const idx = (modes.indexOf(currentMode) + 1) % modes.length;
    currentMode = modes[idx];
    store.setMode(currentMode);
    console.log(`Mode: ${currentMode}`);
  }
});

// Start the app
init().catch(console.error);
