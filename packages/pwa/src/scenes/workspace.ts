import type { Mode, Activity, ToolCategory } from '../types';
import type { AppState, AgentInfo } from '../store/state';
import { ART_CONFIG, TOOL_EFFECT_MAP } from '../types';
import { clearCanvas } from '../engine/canvas';
import { getSprite, hasSprites, getModeFrame, getLimeZuFrame, hasLimeZuSprites } from '../engine/spriteManager';
import { drawSpriteFrame } from '../engine/sprites';
import { drawToolEffects, startToolEffect, stopToolEffect } from '../engine/effects';

// Portrait mode: 180x320
const { internalWidth: IW, internalHeight: IH } = ART_CONFIG;

// =============================================================================
// COLOR PALETTE - Warm office atmosphere inspired by reference
// =============================================================================
const P = {
  // Background & Walls
  bgDark: '#1a1a2e',
  bgMid: '#252538',
  wallDark: '#2d2d44',
  wallMid: '#3d3d58',
  wallLight: '#4a4a66',

  // Floor
  floorDark: '#3a3a4e',
  floorMid: '#4a4a5e',
  floorLight: '#5a5a6e',
  floorGrid: 'rgba(255,255,255,0.05)',

  // Wood (desks, frames)
  woodDark: '#4a3728',
  woodMid: '#5d4a3a',
  woodLight: '#7a5f4a',
  woodHighlight: '#8b7355',

  // Corkboard
  corkDark: '#8b6914',
  corkMid: '#a67c00',
  corkLight: '#c4a000',

  // Whiteboard
  whiteboardFrame: '#5a5a6a',
  whiteboardSurface: '#e8e8f0',
  whiteboardLine: '#4a4a5a',
  diagramBlue: '#4a9eff',
  diagramGreen: '#4aff9e',
  diagramPurple: '#9e4aff',

  // Sticky notes
  stickyYellow: '#fff176',
  stickyPink: '#f48fb1',
  stickyBlue: '#81d4fa',
  stickyGreen: '#a5d6a7',

  // Electronics
  monitorFrame: '#2a2a3a',
  monitorScreen: '#0a0a14',
  screenGlow: '#00ff88',
  screenBlue: '#4a9eff',
  screenError: '#ff4a4a',

  // Server rack
  serverDark: '#1a1a2e',
  serverMid: '#2a2a3e',
  serverLight: '#3a3a4e',
  ledGreen: '#00ff88',
  ledOrange: '#ffaa00',
  ledRed: '#ff4444',
  ledOff: '#1a2020',

  // Water cooler
  coolerBody: '#3a4a5a',
  coolerWater: '#4a9eff',
  coolerHighlight: '#6ab4ff',

  // Character
  skinTone: '#ffd9b3',
  skinShadow: '#e6c49f',
  hairDark: '#3a2a1a',
  shirtBlue: '#4a7aaa',
  shirtDark: '#3a6a9a',
  pantsDark: '#2a3a4a',
  shoes: '#1a1a2a',

  // UI
  uiBg: 'rgba(26,26,46,0.95)',
  uiBorder: 'rgba(255,255,255,0.1)',
  uiText: '#e0e0e0',
  uiAccent: '#00ff88',
  uiWarning: '#ffaa00',
  uiError: '#ff4a4a',

  // Effects
  shadow: 'rgba(0,0,0,0.4)',
  shadowLight: 'rgba(0,0,0,0.2)',
  glow: 'rgba(0,255,136,0.15)',
  warmGlow: 'rgba(255,200,100,0.1)',
  confetti: ['#fff176', '#a5d6a7', '#ffab91', '#81d4fa', '#f48fb1', '#ce93d8'],

  // Lamp
  lampBase: '#3a3a4a',
  lampShade: '#f5deb3',
  lampGlow: 'rgba(255,220,180,0.3)',
};

// =============================================================================
// LAYOUT POSITIONS
// =============================================================================
const HEADER_HEIGHT = 20;
const FOOTER_HEIGHT = 60;
const SCENE_TOP = HEADER_HEIGHT;
const SCENE_HEIGHT = IH - HEADER_HEIGHT - FOOTER_HEIGHT;

// =============================================================================
// ANIMATION TIMING
// =============================================================================
const ANIM = {
  blink: 2500,
  typing: 100,
  thinking: 400,
  ledScan: 80,
  waterBubble: 300,
  confetti: 30,
  walkCycle: 80,
};

// =============================================================================
// CHARACTER STATE
// =============================================================================
let charX = IW * 0.5;
let charY = SCENE_TOP + SCENE_HEIGHT * 0.65;
const MOVE_SPEED = 1.5;

// Target positions based on activity
const POSITIONS = {
  idle: { x: IW * 0.5, y: SCENE_TOP + SCENE_HEIGHT * 0.65 },
  typing: { x: IW * 0.5, y: SCENE_TOP + SCENE_HEIGHT * 0.65 },
  thinking: { x: IW * 0.25, y: SCENE_TOP + SCENE_HEIGHT * 0.45 },
  running: { x: IW * 0.82, y: SCENE_TOP + SCENE_HEIGHT * 0.45 },
  waiting: { x: IW * 0.2, y: SCENE_TOP + SCENE_HEIGHT * 0.75 },
};

// =============================================================================
// MAIN DRAW FUNCTION
// =============================================================================

// Track last tool for effect triggering
let lastToolUseId: string | null = null;

export function drawWorkspace(
  ctx: CanvasRenderingContext2D,
  state: AppState,
  time: number
): void {
  // 1. Clear and draw background
  clearCanvas(ctx, P.bgDark);

  // 2. Draw scene layers
  drawFloor(ctx);
  drawWalls(ctx);

  // 3. Back wall items
  drawWhiteboard(ctx, time, state);
  drawCorkboard(ctx, time);
  drawServerRack(ctx, time, state);

  // 4. Room items
  drawWaterCooler(ctx, time);
  drawDesk(ctx, time, state);
  drawLamp(ctx, time);
  drawPlants(ctx);

  // 5. Character(s)
  const target = getTargetPosition(state.activity);
  updateCharacterPosition(target);
  drawCharacter(ctx, time, state, charX, charY, true);

  // 6. Handle tool effects
  handleToolEffects(state);

  // 7. Draw sub-agents with walk-in animation
  updateAndDrawSubAgents(ctx, time, state);

  // 8. Draw tool/skill effects near character
  drawToolEffects(ctx, time);

  // 9. Effects
  drawLighting(ctx, state.mode);
  if (state.mode === 'celebrate') {
    drawConfetti(ctx, time);
  }

  // 10. UI overlay
  drawHeader(ctx, state, time);
  drawFooter(ctx, state, time);
}

/**
 * Handle tool effect triggering based on state changes
 */
function handleToolEffects(state: AppState): void {
  if (state.currentTool) {
    if (state.currentTool.toolUseId !== lastToolUseId) {
      // New tool started - determine if it's a skill
      const isSkill = state.currentTool.detail?.toLowerCase().includes('skill') ||
                      state.currentTool.context?.toLowerCase().includes('/');
      const effectType = isSkill ? 'skill' : TOOL_EFFECT_MAP[state.currentTool.category];

      // Start effect near character
      startToolEffect(effectType, charX, charY, state.currentTool.toolUseId);
      lastToolUseId = state.currentTool.toolUseId;
    }

    if (state.currentTool.status === 'completed' || state.currentTool.status === 'error') {
      stopToolEffect(state.currentTool.toolUseId);
    }
  } else if (lastToolUseId) {
    lastToolUseId = null;
  }
}

// =============================================================================
// BACKGROUND
// =============================================================================
function drawFloor(ctx: CanvasRenderingContext2D): void {
  const floorY = SCENE_TOP + SCENE_HEIGHT * 0.55;
  const floorHeight = IH - FOOTER_HEIGHT - floorY;

  // Use procedural floor (cleaner look)
  const grad = ctx.createLinearGradient(0, floorY, 0, IH - FOOTER_HEIGHT);
  grad.addColorStop(0, P.floorDark);
  grad.addColorStop(1, P.floorMid);
  ctx.fillStyle = grad;
  ctx.fillRect(0, floorY, IW, floorHeight);

  // Floor grid for depth
  ctx.strokeStyle = P.floorGrid;
  ctx.lineWidth = 1;
  for (let x = 0; x < IW; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, floorY);
    ctx.lineTo(x, IH - FOOTER_HEIGHT);
    ctx.stroke();
  }
  for (let y = floorY; y < IH - FOOTER_HEIGHT; y += 15) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(IW, y);
    ctx.stroke();
  }
}

function drawWalls(ctx: CanvasRenderingContext2D): void {
  const wallBottom = SCENE_TOP + SCENE_HEIGHT * 0.55;
  const wallHeight = wallBottom - SCENE_TOP;

  // Use procedural walls (cleaner look, Room Builder tiles need better mapping)
  const grad = ctx.createLinearGradient(0, SCENE_TOP, 0, wallBottom);
  grad.addColorStop(0, P.wallDark);
  grad.addColorStop(1, P.wallMid);
  ctx.fillStyle = grad;
  ctx.fillRect(0, SCENE_TOP, IW, wallHeight);

  // Baseboard
  ctx.fillStyle = P.woodDark;
  ctx.fillRect(0, wallBottom - 4, IW, 4);
  ctx.fillStyle = P.woodLight;
  ctx.fillRect(0, wallBottom - 4, IW, 1);
}

// =============================================================================
// WHITEBOARD (Thinking station)
// =============================================================================
function drawWhiteboard(ctx: CanvasRenderingContext2D, t: number, state: AppState): void {
  const x = 15;
  const y = SCENE_TOP + 15;
  const w = 55;
  const h = 40;

  // Shadow
  ctx.fillStyle = P.shadowLight;
  ctx.fillRect(x + 2, y + 2, w, h);

  // Frame
  ctx.fillStyle = P.whiteboardFrame;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

  // Surface
  ctx.fillStyle = P.whiteboardSurface;
  ctx.fillRect(x, y, w, h);

  // Flowchart diagram
  ctx.strokeStyle = P.diagramBlue;
  ctx.lineWidth = 1;

  // Boxes
  ctx.strokeRect(x + 8, y + 8, 12, 8);
  ctx.strokeRect(x + 28, y + 8, 12, 8);
  ctx.strokeRect(x + 18, y + 22, 12, 8);

  // Lines
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 16);
  ctx.lineTo(x + 24, y + 22);
  ctx.moveTo(x + 34, y + 16);
  ctx.lineTo(x + 30, y + 22);
  ctx.stroke();

  // Thinking indicator
  if (state.activity === 'thinking') {
    const alpha = 0.5 + Math.sin(t / ANIM.thinking) * 0.3;
    ctx.fillStyle = `rgba(74,158,255,${alpha})`;
    ctx.fillRect(x + 42, y + 28, 8, 8);
    ctx.fillStyle = '#fff';
    ctx.font = '6px monospace';
    ctx.fillText('?', x + 44, y + 35);
  }

  // Marker tray
  ctx.fillStyle = P.whiteboardFrame;
  ctx.fillRect(x, y + h, w, 3);

  // Markers
  const markers = [P.diagramBlue, P.diagramGreen, P.diagramPurple, P.uiError];
  for (let i = 0; i < markers.length; i++) {
    ctx.fillStyle = markers[i];
    ctx.fillRect(x + 5 + i * 10, y + h + 1, 6, 2);
  }
}

// =============================================================================
// CORKBOARD
// =============================================================================
function drawCorkboard(ctx: CanvasRenderingContext2D, t: number): void {
  const x = IW - 60;
  const y = SCENE_TOP + 8;
  const w = 50;
  const h = 35;

  // Shadow
  ctx.fillStyle = P.shadowLight;
  ctx.fillRect(x + 2, y + 2, w, h);

  // Frame
  ctx.fillStyle = P.woodMid;
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);

  // Cork surface
  ctx.fillStyle = P.corkMid;
  ctx.fillRect(x, y, w, h);

  // Cork texture
  ctx.fillStyle = P.corkDark;
  for (let i = 0; i < 10; i++) {
    const cx = x + (i * 17) % w;
    const cy = y + (i * 11) % h;
    ctx.fillRect(cx, cy, 1, 1);
  }

  // Sticky notes with slight sway
  const sway = Math.sin(t / 800) * 0.5;

  const notes = [
    { nx: 5, ny: 5, c: P.stickyYellow, text: 'TODO' },
    { nx: 22, ny: 8, c: P.stickyPink, text: '' },
    { nx: 35, ny: 4, c: P.stickyBlue, text: '' },
    { nx: 12, ny: 20, c: P.stickyGreen, text: 'SHIP' },
  ];

  for (const note of notes) {
    ctx.save();
    ctx.translate(x + note.nx + 5, y + note.ny);
    ctx.rotate(sway * 0.02);
    ctx.fillStyle = note.c;
    ctx.fillRect(-5, 0, 12, 10);
    if (note.text) {
      ctx.fillStyle = '#333';
      ctx.font = '4px monospace';
      ctx.fillText(note.text, -3, 6);
    }
    ctx.restore();
  }

  // "Ship It!" poster
  ctx.fillStyle = P.uiAccent;
  ctx.fillRect(x + 5, y + h - 12, 18, 10);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 4px monospace';
  ctx.fillText('SHIP', x + 7, y + h - 6);
  ctx.fillText('IT!', x + 9, y + h - 2);
}

// =============================================================================
// SERVER RACK (Running station)
// =============================================================================
function drawServerRack(ctx: CanvasRenderingContext2D, t: number, state: AppState): void {
  const x = IW - 28;
  const y = SCENE_TOP + 50;
  const w = 22;
  const h = 55;

  // Shadow
  ctx.fillStyle = P.shadow;
  ctx.fillRect(x + 2, y + 2, w, h);

  // Rack frame
  ctx.fillStyle = P.serverDark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = P.serverMid;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

  // Server units
  for (let i = 0; i < 5; i++) {
    const uy = y + 4 + i * 10;

    // Unit body
    ctx.fillStyle = P.serverDark;
    ctx.fillRect(x + 3, uy, w - 6, 8);
    ctx.fillStyle = P.serverLight;
    ctx.fillRect(x + 4, uy + 1, w - 8, 6);

    // Vents
    ctx.fillStyle = P.serverDark;
    ctx.fillRect(x + 5, uy + 2, 4, 1);
    ctx.fillRect(x + 5, uy + 4, 4, 1);

    // LEDs
    for (let led = 0; led < 2; led++) {
      let color = P.ledOff;

      if (state.mode === 'running' || state.activity === 'thinking') {
        const scanPos = Math.floor(t / ANIM.ledScan) % 10;
        if (scanPos === i * 2 + led) {
          color = P.ledGreen;
        }
      } else if (state.mode === 'error') {
        color = Math.floor(t / 200) % 2 === 0 ? P.ledRed : P.ledOff;
      } else if (state.mode === 'celebrate') {
        color = P.ledGreen;
      } else {
        // Idle pulse
        color = Math.sin(t / 1000 + i) > 0.5 ? P.ledGreen : P.ledOff;
      }

      ctx.fillStyle = color;
      ctx.fillRect(x + w - 8, uy + 2 + led * 3, 3, 2);
    }
  }

  // Glow effect when running
  if (state.mode === 'running') {
    const intensity = 0.1 + Math.sin(t / 150) * 0.05;
    ctx.fillStyle = `rgba(0,255,136,${intensity})`;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 25, 0, Math.PI * 2);
    ctx.fill();
  }
}

// =============================================================================
// WATER COOLER
// =============================================================================
function drawWaterCooler(ctx: CanvasRenderingContext2D, t: number): void {
  const x = 10;
  const y = SCENE_TOP + SCENE_HEIGHT * 0.45;

  // Base
  ctx.fillStyle = P.coolerBody;
  ctx.fillRect(x, y + 20, 14, 8);

  // Body
  ctx.fillRect(x + 1, y + 5, 12, 15);

  // Water bottle
  ctx.fillStyle = P.coolerWater;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(x + 3, y - 5, 8, 12);
  ctx.globalAlpha = 1;

  // Highlight
  ctx.fillStyle = P.coolerHighlight;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x + 4, y - 4, 2, 10);
  ctx.globalAlpha = 1;

  // Bubbles
  if (Math.floor(t / ANIM.waterBubble) % 3 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x + 7, y + ((t / 100) % 10), 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dispenser
  ctx.fillStyle = P.coolerBody;
  ctx.fillRect(x + 4, y + 15, 6, 5);
}

// =============================================================================
// DESK & MONITOR
// =============================================================================
function drawDesk(ctx: CanvasRenderingContext2D, t: number, state: AppState): void {
  const dx = IW * 0.5;
  const dy = SCENE_TOP + SCENE_HEIGHT * 0.55;

  // Desk shadow
  ctx.fillStyle = P.shadowLight;
  ctx.fillRect(dx - 35 + 2, dy + 2, 70, 20);

  // Desk surface
  ctx.fillStyle = P.woodLight;
  ctx.fillRect(dx - 35, dy - 2, 70, 4);
  ctx.fillStyle = P.woodHighlight;
  ctx.fillRect(dx - 35, dy - 2, 70, 1);

  // Desk front
  ctx.fillStyle = P.woodMid;
  ctx.fillRect(dx - 35, dy + 2, 70, 18);
  ctx.fillStyle = P.woodDark;
  ctx.fillRect(dx - 35, dy + 18, 70, 2);

  // Drawer
  ctx.strokeStyle = P.woodDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(dx - 12, dy + 6, 24, 10);
  ctx.fillStyle = P.woodDark;
  ctx.fillRect(dx - 2, dy + 10, 4, 2);

  // Monitor
  drawMonitor(ctx, dx, dy - 30, t, state);

  // Keyboard
  drawKeyboard(ctx, dx, dy - 5, t, state);

  // Coffee mug - try sprite first
  const thingsSheet = getSprite('things');
  if (thingsSheet && thingsSheet.frames.has('thing_0_0')) {
    drawSpriteFrame(ctx, thingsSheet, 'thing_0_0', dx + 22, dy - 12);
  } else {
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(dx + 25, dy - 8, 7, 6);
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(dx + 26, dy - 7, 5, 2);
  }

  // Papers - try sprite first
  if (thingsSheet && thingsSheet.frames.has('thing_0_2')) {
    drawSpriteFrame(ctx, thingsSheet, 'thing_0_2', dx - 32, dy - 10);
  } else {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(dx - 30, dy - 6, 8, 10);
    ctx.fillStyle = P.stickyYellow;
    ctx.fillRect(dx - 29, dy - 4, 5, 5);
  }
}

function drawMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, state: AppState): void {
  const mw = 32;
  const mh = 24;

  // Frame
  ctx.fillStyle = P.monitorFrame;
  ctx.fillRect(x - mw / 2 - 2, y - 2, mw + 4, mh + 4);

  // Screen
  ctx.fillStyle = P.monitorScreen;
  ctx.fillRect(x - mw / 2, y, mw, mh);

  // Screen content based on state
  if (state.mode === 'typing' || state.activity === 'responding') {
    // Code lines
    ctx.fillStyle = P.screenGlow;
    const lines = [8, 14, 10, 16, 6, 12, 8];
    for (let i = 0; i < lines.length; i++) {
      const animated = i === lines.length - 1;
      const lw = animated ? lines[i] * (0.5 + Math.sin(t / 150) * 0.5) : lines[i];
      ctx.fillRect(x - mw / 2 + 2, y + 2 + i * 3, lw, 2);
    }
    // Cursor
    if (Math.floor(t / 300) % 2 === 0) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - mw / 2 + 2 + lines[lines.length - 1], y + 2 + (lines.length - 1) * 3, 2, 2);
    }
  } else if (state.mode === 'running') {
    // Terminal output
    ctx.fillStyle = P.screenGlow;
    const offset = Math.floor(t / 80) % 6;
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x - mw / 2 + 2, y + 2 + ((i + offset) % 6) * 3, 8 + ((i * 7) % 14), 2);
    }
  } else if (state.mode === 'celebrate') {
    // Checkmark
    ctx.strokeStyle = P.screenGlow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 12);
    ctx.lineTo(x - 2, y + 18);
    ctx.lineTo(x + 10, y + 6);
    ctx.stroke();
  } else if (state.mode === 'error') {
    // X mark
    ctx.strokeStyle = P.screenError;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 6);
    ctx.lineTo(x + 8, y + 18);
    ctx.moveTo(x + 8, y + 6);
    ctx.lineTo(x - 8, y + 18);
    ctx.stroke();
  } else if (state.activity === 'thinking') {
    // Dots
    ctx.fillStyle = P.screenGlow;
    const frame = Math.floor(t / 400) % 4;
    for (let i = 0; i < 3; i++) {
      if (i < frame) {
        ctx.fillRect(x - 6 + i * 5, y + 10, 3, 3);
      }
    }
  } else {
    // Idle - dim code
    ctx.fillStyle = 'rgba(0,255,136,0.3)';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x - mw / 2 + 2, y + 2 + i * 4, 6 + (i * 3) % 10, 2);
    }
  }

  // Stand
  ctx.fillStyle = P.monitorFrame;
  ctx.fillRect(x - 4, y + mh + 2, 8, 4);
  ctx.fillRect(x - 8, y + mh + 5, 16, 2);
}

function drawKeyboard(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, state: AppState): void {
  ctx.fillStyle = P.serverMid;
  ctx.fillRect(x - 14, y, 28, 6);

  ctx.fillStyle = P.serverDark;
  const typingKey = state.mode === 'typing' ? Math.floor(t / ANIM.typing) % 20 : -1;
  let keyIdx = 0;
  const rows = [
    [-11, -9, -7, -5, -3, -1, 1, 3, 5, 7, 9],
    [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8],
    [-9, -7, -5, -3, -1, 1, 3, 5, 7],
  ];
  for (let row = 0; row < rows.length; row++) {
    for (const kx of rows[row]) {
      const pressed = keyIdx === typingKey;
      ctx.fillRect(x + kx, y + 1 + row * 1.7 + (pressed ? 0.5 : 0), 1.5, 1);
      keyIdx++;
    }
  }
}

// =============================================================================
// LAMP
// =============================================================================
function drawLamp(ctx: CanvasRenderingContext2D, t: number): void {
  const x = IW * 0.75;
  const y = SCENE_TOP + SCENE_HEIGHT * 0.48;

  // Base
  ctx.fillStyle = P.lampBase;
  ctx.fillRect(x - 4, y + 20, 8, 3);
  ctx.fillRect(x - 1, y + 5, 2, 15);

  // Shade
  ctx.fillStyle = P.lampShade;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 8);
  ctx.lineTo(x + 8, y + 8);
  ctx.lineTo(x + 5, y);
  ctx.lineTo(x - 5, y);
  ctx.closePath();
  ctx.fill();

  // Glow
  ctx.fillStyle = P.lampGlow;
  ctx.beginPath();
  ctx.arc(x, y + 15, 15, 0, Math.PI * 2);
  ctx.fill();
}

// =============================================================================
// PLANTS (procedural for now - sprite coordinates need proper mapping)
// =============================================================================
function drawPlants(ctx: CanvasRenderingContext2D): void {
  // Procedural plants (cleaner until sprite coords are properly mapped)
  drawProceduralPlant(ctx, 5, SCENE_TOP + SCENE_HEIGHT * 0.4, 'medium');
  drawProceduralPlant(ctx, IW - 42, SCENE_TOP + SCENE_HEIGHT * 0.5, 'small');
}

function drawProceduralPlant(ctx: CanvasRenderingContext2D, x: number, y: number, size: 'small' | 'medium' | 'large'): void {
  const h = size === 'small' ? 12 : size === 'medium' ? 20 : 30;
  const w = size === 'small' ? 8 : size === 'medium' ? 12 : 18;

  // Pot
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(x, y + h - 6, w, 6);
  ctx.fillStyle = '#654321';
  ctx.fillRect(x + 1, y + h - 5, w - 2, 1);

  // Leaves
  ctx.fillStyle = '#228b22';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2 - 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = '#32cd32';
  ctx.beginPath();
  ctx.ellipse(x + w / 3, y + h / 3, w / 4, h / 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

// =============================================================================
// CHARACTER
// =============================================================================
function getTargetPosition(activity: Activity): { x: number; y: number } {
  switch (activity) {
    case 'thinking':
      return POSITIONS.thinking;
    case 'responding':
      return POSITIONS.typing;
    case 'waiting':
      return POSITIONS.waiting;
    default:
      return POSITIONS.idle;
  }
}

function updateCharacterPosition(target: { x: number; y: number }): void {
  const dx = target.x - charX;
  const dy = target.y - charY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > MOVE_SPEED) {
    charX += (dx / dist) * MOVE_SPEED;
    charY += (dy / dist) * MOVE_SPEED;
  } else {
    charX = target.x;
    charY = target.y;
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: AppState,
  x: number,
  y: number,
  isMain: boolean
): void {
  const animFrame = Math.floor(t / 200) % 4;
  let bodyOffset = 0;
  let armOffset = 0;

  const target = getTargetPosition(state.activity);
  const isWalking = Math.abs(target.x - x) > 2 || Math.abs(target.y - y) > 2;

  if (isWalking) {
    bodyOffset = Math.sin(t / ANIM.walkCycle) * 1;
  } else if (state.mode === 'typing') {
    armOffset = animFrame % 2 === 0 ? -1 : 1;
  } else if (state.mode === 'thinking') {
    armOffset = -2;
  } else if (state.mode === 'celebrate') {
    bodyOffset = -Math.abs(Math.sin(t / 150) * 3);
    armOffset = -4;
  } else if (state.mode === 'error') {
    bodyOffset = animFrame % 2;
  }

  const baseY = y + bodyOffset;

  // Shadow
  ctx.fillStyle = P.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Try LimeZu sprites first (high quality 16x32 characters)
  const limeZuIdle = getSprite('limezu-adam-idle');
  const limeZuSit = getSprite('limezu-adam-sit');
  const limeZuRun = getSprite('limezu-adam-run');

  if (limeZuIdle || limeZuSit || limeZuRun) {
    // Use LimeZu character sprites
    let sheet = limeZuIdle;
    let animPrefix = 'adam_idle';

    if (isWalking && limeZuRun) {
      sheet = limeZuRun;
      animPrefix = 'adam_run';
    } else if ((state.mode === 'typing' || state.mode === 'idle') && limeZuSit) {
      sheet = limeZuSit;
      animPrefix = 'adam_sit';
    }

    if (sheet) {
      const frameName = getLimeZuFrame(animPrefix, t, 'down');
      // LimeZu sprites are 16x32, center horizontally
      drawSpriteFrame(ctx, sheet, frameName, x - 8, baseY - 32);
    }
  } else {
    // Try OpenGameArt characters
    const charSheet = getSprite('characters');
    if (charSheet) {
      const frameName = getModeFrame(state.mode, t);
      drawSpriteFrame(ctx, charSheet, frameName, x - 8, baseY - 24);
    } else {
      // Fallback: Procedural character from behind (facing monitor)

      // Legs
      ctx.fillStyle = P.pantsDark;
      ctx.fillRect(x - 3, baseY - 8, 3, 8);
      ctx.fillRect(x, baseY - 8, 3, 8);

      // Body/shirt
      ctx.fillStyle = P.shirtBlue;
      ctx.fillRect(x - 4, baseY - 18, 8, 10);
      ctx.fillStyle = P.shirtDark;
      ctx.fillRect(x - 4, baseY - 18, 2, 10);

      // Arms
      ctx.fillStyle = P.shirtBlue;
      ctx.fillRect(x - 6, baseY - 16 + armOffset, 2, 6);
      ctx.fillRect(x + 4, baseY - 16 + armOffset, 2, 6);

      // Hands
      ctx.fillStyle = P.skinTone;
      ctx.fillRect(x - 6, baseY - 10 + armOffset, 2, 2);
      ctx.fillRect(x + 4, baseY - 10 + armOffset, 2, 2);

      // Head (back of head - hair)
      ctx.fillStyle = P.hairDark;
      ctx.fillRect(x - 4, baseY - 26, 8, 8);
      ctx.fillRect(x - 5, baseY - 24, 10, 4);
    }
  }

  // Chair (always procedural - looks fine)
  ctx.fillStyle = P.serverMid;
  ctx.fillRect(x - 6, baseY - 5, 12, 6);
  ctx.fillStyle = P.serverDark;
  ctx.fillRect(x - 7, baseY - 12, 2, 14);
  ctx.fillRect(x + 5, baseY - 12, 2, 14);
  ctx.fillRect(x - 7, baseY - 13, 14, 2);

  // Mode effects
  if (state.mode === 'thinking' && !isWalking && isMain) {
    // Thought bubble
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x + 12, baseY - 32, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 6, baseY - 26, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.diagramPurple;
    ctx.font = 'bold 6px monospace';
    ctx.fillText(['?', '...', '!'][Math.floor(t / 400) % 3], x + 9, baseY - 30);
  } else if (state.mode === 'celebrate' && !isWalking && isMain) {
    // Stars
    ctx.fillStyle = P.stickyYellow;
    const starY = baseY - 34 - Math.sin(t / 200) * 2;
    drawStar(ctx, x - 6, starY, 3);
    drawStar(ctx, x, starY - 3, 4);
    drawStar(ctx, x + 6, starY, 3);
  } else if (state.mode === 'error' && !isWalking && isMain) {
    // Error indicator
    ctx.fillStyle = P.uiError;
    ctx.fillRect(x - 1, baseY - 38, 3, 6);
    ctx.fillRect(x - 1, baseY - 30, 3, 2);
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillRect(x - size / 2, y - 1, size, 2);
  ctx.fillRect(x - 1, y - size / 2, 2, size);
}

// =============================================================================
// SUB-AGENTS WITH WALK-IN ANIMATION
// =============================================================================

// Character color tints for variety
const CHARACTER_TINTS = [
  null,                    // Default (no tint)
  'hue-rotate(180deg)',    // Cyan
  'hue-rotate(300deg)',    // Pink
  'hue-rotate(45deg)',     // Gold
  'hue-rotate(120deg)',    // Green
  'hue-rotate(270deg)',    // Purple
];

const WALK_SPEED = 0.8;

function updateAndDrawSubAgents(ctx: CanvasRenderingContext2D, t: number, state: AppState): void {
  for (const [agentId, agent] of state.agents) {
    // Update position based on animation state
    updateAgentPosition(agent);

    // Draw the mini character at its current position
    drawMiniCharacter(ctx, agent.x, agent.y, agent, t);
  }
}

function updateAgentPosition(agent: AgentInfo): void {
  const dx = agent.targetX - agent.x;
  const dy = agent.targetY - agent.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > WALK_SPEED) {
    // Move towards target
    agent.x += (dx / dist) * WALK_SPEED;
    agent.y += (dy / dist) * WALK_SPEED;
  } else {
    // Arrived at target
    agent.x = agent.targetX;
    agent.y = agent.targetY;

    // Update animation state
    if (agent.animState === 'walking_in') {
      agent.animState = 'active';
    } else if (agent.animState === 'walking_out') {
      agent.animState = 'exited';
    }
  }
}

// Legacy function kept for compatibility
function drawSubAgents(ctx: CanvasRenderingContext2D, t: number, state: AppState): void {
  updateAndDrawSubAgents(ctx, t, state);
}

function drawMiniCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, agent: AgentInfo, t: number): void {
  const scale = 0.6;
  const isWalking = agent.animState === 'walking_in' || agent.animState === 'walking_out';

  // Determine facing direction based on movement
  const movingRight = agent.targetX > agent.x;
  const direction = isWalking ? (movingRight ? 'right' : 'left') : 'down';

  // Shadow
  ctx.fillStyle = P.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 4, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Apply color tint for character variety
  const tint = CHARACTER_TINTS[agent.characterIndex % CHARACTER_TINTS.length];

  // Try to use Alex sprites for sub-agents
  const alexIdle = getSprite('limezu-alex-idle');
  const alexRun = getSprite('limezu-alex-run');

  if (alexIdle || alexRun) {
    // Choose sprite based on walking state
    const sheet = isWalking && alexRun ? alexRun : alexIdle;
    const animPrefix = isWalking ? 'alex_run' : 'alex_idle';

    if (sheet) {
      const frameName = getLimeZuFrame(animPrefix, t, direction);

      ctx.save();
      ctx.translate(x - 8 * scale, y - 32 * scale);
      ctx.scale(scale, scale);

      // Apply tint filter if available
      if (tint) {
        ctx.filter = tint;
      }

      drawSpriteFrame(ctx, sheet, frameName, 0, 0);
      ctx.restore();
    }
  } else {
    // Fallback: Try OpenGameArt characters
    const charSheet = getSprite('characters');
    if (charSheet) {
      const frameIdx = Math.floor(t / 300) % 2;
      const frameName = isWalking ? `walk_${frameIdx}` : `idle_${frameIdx}`;

      ctx.save();
      ctx.translate(x - 8, y - 16);
      ctx.scale(scale, scale);
      if (tint) ctx.filter = tint;
      drawSpriteFrame(ctx, charSheet, frameName, 0, 0);
      ctx.restore();
    } else {
      // Fallback: Procedural mini character with tinted color
      const baseColor = agent.status === 'error' ? P.uiError : agent.status === 'completed' ? P.uiAccent : P.shirtBlue;
      ctx.fillStyle = baseColor;
      ctx.fillRect(x - 3 * scale, y - 12 * scale, 6 * scale, 8 * scale);

      ctx.fillStyle = P.hairDark;
      ctx.fillRect(x - 3 * scale, y - 18 * scale, 6 * scale, 5 * scale);
    }
  }

  // Status indicator (always show)
  const indicatorY = y - 22 * scale;
  if (agent.status === 'running') {
    const pulse = Math.sin(t / 200) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(0,255,136,${pulse})`;
    ctx.beginPath();
    ctx.arc(x, indicatorY, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (agent.status === 'completed') {
    ctx.fillStyle = P.uiAccent;
    ctx.beginPath();
    ctx.arc(x, indicatorY, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (agent.status === 'error') {
    ctx.fillStyle = P.uiError;
    ctx.beginPath();
    ctx.arc(x, indicatorY, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// =============================================================================
// EFFECTS
// =============================================================================
function drawLighting(ctx: CanvasRenderingContext2D, mode: Mode): void {
  if (mode === 'running') {
    ctx.fillStyle = 'rgba(0,255,136,0.05)';
    ctx.fillRect(0, SCENE_TOP, IW, SCENE_HEIGHT);
  } else if (mode === 'error') {
    ctx.fillStyle = 'rgba(255,74,74,0.08)';
    ctx.fillRect(0, SCENE_TOP, IW, SCENE_HEIGHT);
  } else if (mode === 'celebrate') {
    ctx.fillStyle = 'rgba(255,241,118,0.06)';
    ctx.fillRect(0, SCENE_TOP, IW, SCENE_HEIGHT);
  }
}

function drawConfetti(ctx: CanvasRenderingContext2D, t: number): void {
  for (let i = 0; i < 15; i++) {
    const seed = i * 137.5;
    const x = (seed + t / 15) % IW;
    const y = ((seed * 2.3 + t / ANIM.confetti) % (SCENE_HEIGHT + 20)) + SCENE_TOP - 10;
    const rot = (t / 100 + seed) % (Math.PI * 2);
    const size = 2 + (i % 3);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = P.confetti[i % P.confetti.length];
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);
    ctx.restore();
  }
}

// =============================================================================
// UI OVERLAYS
// =============================================================================
function drawHeader(ctx: CanvasRenderingContext2D, state: AppState, time: number): void {
  // Background
  ctx.fillStyle = P.uiBg;
  ctx.fillRect(0, 0, IW, HEADER_HEIGHT);

  // Border
  ctx.fillStyle = P.uiBorder;
  ctx.fillRect(0, HEADER_HEIGHT - 1, IW, 1);

  // Connection indicator
  const connected = state.connectionState === 'connected' || state.connectionState === 'authenticated';
  ctx.fillStyle = connected ? P.uiAccent : P.uiError;
  ctx.beginPath();
  ctx.arc(10, HEADER_HEIGHT / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Title
  ctx.fillStyle = P.uiText;
  ctx.font = 'bold 8px monospace';
  ctx.fillText('PixelHQ', 18, HEADER_HEIGHT / 2 + 3);

  // Session timer (right side)
  if (state.sessionStartTime) {
    const elapsed = Date.now() - state.sessionStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '7px monospace';
    ctx.fillText(timeStr, IW - 28, HEADER_HEIGHT / 2 + 2);
  } else if (state.session) {
    // Fallback: show project name
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '6px monospace';
    const projectName = state.session.project.split('/').pop() || state.session.project;
    ctx.fillText(projectName.slice(0, 8), IW - 45, HEADER_HEIGHT / 2 + 2);
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, state: AppState, t: number): void {
  const footerY = IH - FOOTER_HEIGHT;

  // Background
  ctx.fillStyle = P.uiBg;
  ctx.fillRect(0, footerY, IW, FOOTER_HEIGHT);

  // Border
  ctx.fillStyle = P.uiBorder;
  ctx.fillRect(0, footerY, IW, 1);

  // Status line
  const statusY = footerY + 12;
  const statusColors: Record<Mode, string> = {
    idle: P.uiText,
    typing: P.uiAccent,
    running: P.uiWarning,
    thinking: P.diagramPurple,
    celebrate: P.stickyYellow,
    error: P.uiError,
  };
  const statusNames: Record<Mode, string> = {
    idle: 'IDLE',
    typing: 'TYPING',
    running: 'RUNNING',
    thinking: 'THINKING',
    celebrate: 'COMPLETE',
    error: 'ERROR',
  };

  // Status dot
  ctx.fillStyle = statusColors[state.mode];
  ctx.beginPath();
  ctx.arc(10, statusY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Status text
  ctx.fillStyle = statusColors[state.mode];
  ctx.font = 'bold 7px monospace';
  ctx.fillText(statusNames[state.mode], 18, statusY + 2);

  // Tool info
  if (state.currentTool) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '6px monospace';
    const toolText = state.currentTool.context || state.currentTool.detail;
    ctx.fillText(toolText.slice(0, 20), 70, statusY + 2);
  }

  // Mode buttons
  const modes: { mode: Mode; icon: string; label: string }[] = [
    { mode: 'running', icon: '▶', label: 'Run' },
    { mode: 'idle', icon: '◯', label: 'Idle' },
    { mode: 'typing', icon: '⌨', label: 'Type' },
    { mode: 'thinking', icon: '💡', label: 'Think' },
    { mode: 'error', icon: '!', label: 'Err' },
  ];

  const btnY = footerY + 30;
  const btnW = 32;
  const btnH = 24;
  const startX = (IW - modes.length * btnW) / 2;

  for (let i = 0; i < modes.length; i++) {
    const btn = modes[i];
    const bx = startX + i * btnW;
    const isActive = state.mode === btn.mode;

    // Button background
    ctx.fillStyle = isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(bx + 2, btnY, btnW - 4, btnH);

    // Border
    ctx.strokeStyle = isActive ? statusColors[btn.mode] : P.uiBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 2, btnY, btnW - 4, btnH);

    // Icon
    ctx.fillStyle = isActive ? statusColors[btn.mode] : 'rgba(255,255,255,0.5)';
    ctx.font = '8px monospace';
    ctx.fillText(btn.icon, bx + 12, btnY + 10);

    // Label
    ctx.font = '5px monospace';
    ctx.fillText(btn.label, bx + 8, btnY + 19);
  }

  // Token progress bar (top right of footer)
  const tokens = state.tokens.totalInput + state.tokens.totalOutput;
  const budget = state.estimatedTokenBudget || 100000;
  const progress = Math.min(1, tokens / budget);

  const barX = IW - 55;
  const barWidth = 35;
  const barHeight = 4;

  // Progress bar background
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(barX, statusY - 2, barWidth, barHeight);

  // Progress fill with color coding
  const progressColor = progress < 0.6 ? P.uiAccent : progress < 0.85 ? P.uiWarning : P.uiError;
  ctx.fillStyle = progressColor;
  ctx.fillRect(barX, statusY - 2, barWidth * progress, barHeight);

  // Token count text below bar
  if (tokens > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '5px monospace';
    const tokenText = tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`;
    ctx.fillText(tokenText, barX + barWidth / 2 - 8, statusY + 6);
  }
}
