import type { Mode } from '../types';
import { ART_CONFIG } from '../types';
import { clearCanvas } from '../engine/canvas';

// Portrait mode: 180x320
const { internalWidth: IW, internalHeight: IH } = ART_CONFIG;

// =============================================================================
// COLOR PALETTE - Professional office with warm accents
// =============================================================================
const P = {
  // Night sky (through window)
  sky: '#0a1628',
  skyMid: '#152238',
  skyLight: '#1e3a5f',
  cityDark: '#0d1018',
  cityMid: '#111822',
  cityWindow: '#ffd166',
  cityWindowDim: '#a08040',

  // Walls & Architecture
  wallDark: '#1a202c',
  wallMid: '#2d3748',
  wallLight: '#3d4852',
  trim: '#4a5568',
  trimLight: '#5a6a7a',

  // Floor
  floorDark: '#1a202c',
  floorMid: '#252d38',
  floorLight: '#2d3748',

  // Ceiling lights
  lightFixture: '#3d4852',
  lightGlow: '#ffeaa7',
  lightGlowDim: 'rgba(255,234,167,0.3)',

  // Desk (warm wood)
  deskDark: '#4a3728',
  deskMid: '#5d4a3a',
  deskLight: '#7a5f4a',
  deskHighlight: '#8b7355',

  // Chair
  chairDark: '#2d3748',
  chairMid: '#3d4852',
  chairLight: '#4a5568',

  // Electronics
  monitorFrame: '#1a1a2e',
  monitorScreen: '#0d1117',
  screenGlow: '#00ff88',
  screenGlowDim: 'rgba(0,255,136,0.1)',
  errorGlow: '#f56565',
  celebrateGlow: '#f6e05e',

  // Server rack
  serverDark: '#1a1a2e',
  serverMid: '#2d3748',
  serverLight: '#3d4852',
  serverLED: '#00ff88',
  serverLEDOff: '#1a2030',
  serverError: '#f56565',

  // Whiteboard
  boardFrame: '#4a5568',
  boardFrameDark: '#3d4852',
  boardSurface: '#e2e8f0',
  markerBlue: '#3182ce',
  markerPurple: '#805ad5',
  stickyYellow: '#f6e05e',
  stickyPink: '#ed64a6',
  stickyBlue: '#63b3ed',
  stickyGreen: '#68d391',

  // Lounge & Celebration
  sofaDark: '#3d4852',
  sofaMid: '#4a5568',
  sofaLight: '#5a6a7a',
  gongGold: '#d69e2e',
  gongGoldDark: '#b7791f',
  gongGoldLight: '#ecc94b',
  gongStand: '#4a3728',

  // Coffee machine
  machineDark: '#1a202c',
  machineMid: '#2d3748',

  // Decor
  potTerracotta: '#c53030',
  potTerracottaDark: '#9b2c2c',
  leafGreen: '#48bb78',
  leafGreenDark: '#38a169',
  leafHighlight: '#68d391',

  // Bookshelf
  shelfWood: '#5d4a3a',
  shelfWoodDark: '#4a3728',
  bookRed: '#c53030',
  bookBlue: '#3182ce',
  bookGreen: '#38a169',
  bookYellow: '#d69e2e',
  bookPurple: '#805ad5',

  // Coffee mug
  mugBody: '#e2e8f0',
  coffeeDark: '#5d4037',
  steam: 'rgba(255,255,255,0.25)',

  // Wastebasket
  basketDark: '#3d4852',
  basketMid: '#4a5568',
  paper: '#e2e8f0',
  paperCrumpled: '#cbd5e0',

  // Character
  skin: '#ffd9b3',
  skinDark: '#e6c49f',
  hair: '#4a3728',
  shirtBlue: '#3182ce',
  shirtBlueDark: '#2c5282',
  pantsDark: '#2d3748',
  shoes: '#1a202c',

  // Effects
  shadow: 'rgba(0,0,0,0.3)',
  shadowLight: 'rgba(0,0,0,0.15)',
  warmGlow: 'rgba(255,180,100,0.12)',
  errorTint: 'rgba(245,101,101,0.1)',
  celebrateTint: 'rgba(246,224,94,0.1)',

  // Confetti
  confetti: ['#f6e05e', '#48bb78', '#ed8936', '#63b3ed', '#f56565', '#805ad5'],

  // Poster
  posterBg: '#2d3748',
  posterAccent: '#48bb78',
};

// =============================================================================
// VERTICAL STATION POSITIONS (Portrait layout)
// =============================================================================
const STATIONS = {
  // thinking - upper area (whiteboard)
  whiteboard: {
    x: IW * 0.5,
    y: 75,
    width: 70,
    height: 45,
    charPos: { x: IW * 0.5, y: 130 },
  },
  // running - middle area (server rack)
  serverRack: {
    x: IW * 0.72,
    y: 140,
    width: 32,
    height: 55,
    charPos: { x: IW * 0.55, y: 195 },
  },
  // typing - lower middle (desk)
  desk: {
    x: IW * 0.5,
    y: 215,
    charPos: { x: IW * 0.5, y: 245 },
  },
  // celebrate - bottom (lounge)
  lounge: {
    sofaX: IW * 0.25,
    gongX: IW * 0.78,
    y: 275,
    charPos: { x: IW * 0.5, y: 290 },
  },
  // idle - center
  idle: {
    charPos: { x: IW * 0.5, y: 200 },
  },
};

// =============================================================================
// ANIMATION TIMING
// =============================================================================
const ANIM = {
  starTwinkle: 500,
  plantSway: 1000,
  stickyNoteSway: 800,
  steamRise: 200,
  ledScan: 100,
  typing: 80,
  confetti: 35,
  walkCycle: 70,
  blink: 2000,
  gongRing: 150,
  lightFlicker: 3000,
};

// =============================================================================
// CHARACTER STATE
// =============================================================================
let currentX = STATIONS.idle.charPos.x;
let currentY = STATIONS.idle.charPos.y;
const MOVE_SPEED = 2;

// =============================================================================
// MAIN DRAW FUNCTION
// =============================================================================
export function drawOffice(ctx: CanvasRenderingContext2D, mode: Mode, time: number): void {
  // 1. Background layers
  clearCanvas(ctx, P.wallDark);
  drawSkyAndWindow(ctx, time);
  drawWalls(ctx);
  drawCeilingLights(ctx, time);

  // 2. Back wall decorations
  drawCompanySign(ctx);
  drawPoster(ctx);

  // 3. Work stations (top to bottom)
  drawWhiteboard(ctx, time, mode);
  drawServerRack(ctx, time, mode);
  drawBookshelf(ctx);
  drawPlant(ctx, time, mode);

  // 4. Desk area
  drawDesk(ctx, time, mode);

  // 5. Floor & lounge
  drawFloor(ctx);
  drawSofa(ctx);
  drawCoffeeMachine(ctx, time, mode);
  drawGong(ctx, time, mode);
  drawWastebasket(ctx, mode, time);

  // 6. Character
  const target = getTargetPosition(mode);
  updateCharacterPosition(target);
  drawCharacter(ctx, time, mode);

  // 7. Lighting effects
  drawLighting(ctx, mode, time);
  if (mode === 'celebrate') {
    drawConfetti(ctx, time);
  }
  drawVignette(ctx);

  // 8. Status UI
  drawStatus(ctx, mode);
}

// =============================================================================
// BACKGROUND
// =============================================================================
function drawSkyAndWindow(ctx: CanvasRenderingContext2D, t: number): void {
  const wx = IW * 0.5 - 30;
  const wy = 15;
  const ww = 60;
  const wh = 40;

  // Window frame shadow
  ctx.fillStyle = P.shadow;
  ctx.fillRect(wx + 2, wy + 2, ww, wh);

  // Window frame
  ctx.fillStyle = P.wallLight;
  ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
  skyGrad.addColorStop(0, P.sky);
  skyGrad.addColorStop(0.5, P.skyMid);
  skyGrad.addColorStop(1, P.skyLight);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(wx, wy, ww, wh);

  // City silhouette
  ctx.fillStyle = P.cityDark;
  const buildings = [
    { x: 0, w: 8, h: 18 },
    { x: 10, w: 6, h: 22 },
    { x: 18, w: 10, h: 15 },
    { x: 30, w: 7, h: 25 },
    { x: 40, w: 8, h: 20 },
    { x: 50, w: 10, h: 12 },
  ];
  for (const b of buildings) {
    ctx.fillRect(wx + b.x, wy + wh - b.h, b.w, b.h);
  }

  // Building windows
  for (const b of buildings) {
    if (b.h > 15) {
      for (let row = 0; row < Math.floor(b.h / 5); row++) {
        for (let col = 0; col < Math.floor(b.w / 4); col++) {
          const on = Math.sin(t / 2000 + b.x + row * 3 + col) > 0;
          ctx.fillStyle = on ? P.cityWindow : P.cityWindowDim;
          ctx.globalAlpha = on ? 0.8 : 0.2;
          ctx.fillRect(wx + b.x + col * 4 + 1, wy + wh - b.h + row * 5 + 2, 2, 2);
        }
      }
    }
  }
  ctx.globalAlpha = 1;

  // Stars
  ctx.fillStyle = '#fff';
  const stars = [[5, 5], [15, 8], [35, 4], [50, 10], [25, 6]];
  for (const [sx, sy] of stars) {
    if (Math.sin(t / ANIM.starTwinkle + sx) > 0.3) {
      ctx.globalAlpha = 0.5 + Math.sin(t / 300 + sx) * 0.3;
      ctx.fillRect(wx + sx, wy + sy, 1, 1);
    }
  }
  ctx.globalAlpha = 1;

  // Window panes
  ctx.strokeStyle = P.wallLight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy);
  ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.moveTo(wx, wy + wh / 2);
  ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.stroke();

  // Glass reflection
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(wx + 2, wy + 2, ww / 3, wh - 4);
}

function drawWalls(ctx: CanvasRenderingContext2D): void {
  // Side panels (frame the office)
  ctx.fillStyle = P.wallDark;
  ctx.fillRect(0, 0, 8, IH);
  ctx.fillRect(IW - 8, 0, 8, IH);

  // Panel highlights
  ctx.fillStyle = P.wallMid;
  ctx.fillRect(7, 0, 1, IH);
  ctx.fillRect(IW - 8, 0, 1, IH);

  // Upper wall gradient
  const wallGrad = ctx.createLinearGradient(0, 0, 0, 140);
  wallGrad.addColorStop(0, P.wallDark);
  wallGrad.addColorStop(1, P.wallMid);
  ctx.fillStyle = wallGrad;
  ctx.fillRect(8, 60, IW - 16, 80);

  // Baseboard at transition to floor area
  ctx.fillStyle = P.trim;
  ctx.fillRect(8, 255, IW - 16, 3);
}

function drawCeilingLights(ctx: CanvasRenderingContext2D, t: number): void {
  const lights = [IW * 0.3, IW * 0.7];

  for (let i = 0; i < lights.length; i++) {
    const lx = lights[i];
    const ly = 8;

    // Cord
    ctx.strokeStyle = P.wallDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, ly);
    ctx.stroke();

    // Light fixture
    ctx.fillStyle = P.lightFixture;
    ctx.fillRect(lx - 8, ly, 16, 4);

    // Light glow (pulsing slightly)
    const flicker = Math.sin(t / ANIM.lightFlicker + i) > 0.95 ? 0.5 : 1;
    ctx.fillStyle = P.lightGlowDim;
    ctx.globalAlpha = 0.3 * flicker;
    ctx.beginPath();
    ctx.arc(lx, ly + 15, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Bulb
    ctx.fillStyle = P.lightGlow;
    ctx.globalAlpha = 0.8 * flicker;
    ctx.fillRect(lx - 4, ly + 3, 8, 3);
    ctx.globalAlpha = 1;
  }
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  // Floor gradient
  const floorGrad = ctx.createLinearGradient(0, 258, 0, IH);
  floorGrad.addColorStop(0, P.floorMid);
  floorGrad.addColorStop(1, P.floorDark);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(8, 258, IW - 16, IH - 258);

  // Floor grid
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  for (let x = 8; x < IW - 8; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 258);
    ctx.lineTo(x, IH);
    ctx.stroke();
  }
  for (let y = 258; y < IH; y += 15) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(IW - 8, y);
    ctx.stroke();
  }
}

// =============================================================================
// DECORATIONS
// =============================================================================
function drawCompanySign(ctx: CanvasRenderingContext2D): void {
  const sx = IW * 0.5 - 25;
  const sy = 62;
  const sw = 50;
  const sh = 10;

  // Shadow
  ctx.fillStyle = P.shadow;
  ctx.fillRect(sx + 2, sy + 2, sw, sh);

  // Frame
  ctx.fillStyle = P.trim;
  ctx.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);

  // Sign face
  ctx.fillStyle = P.posterBg;
  ctx.fillRect(sx, sy, sw, sh);

  // Text
  ctx.fillStyle = P.posterAccent;
  ctx.font = 'bold 6px monospace';
  ctx.fillText('PIXELHQ', sx + 8, sy + 7);
}

function drawPoster(ctx: CanvasRenderingContext2D): void {
  // "SHIP IT" poster on left wall
  const px = 12;
  const py = 80;

  ctx.fillStyle = P.posterBg;
  ctx.fillRect(px, py, 18, 24);
  ctx.fillStyle = P.posterAccent;
  ctx.fillRect(px + 2, py + 2, 14, 5);
  ctx.fillStyle = '#fff';
  ctx.font = '4px monospace';
  ctx.fillText('SHIP', px + 3, py + 6);
  ctx.fillText('IT!', px + 5, py + 14);

  // Code brackets poster on right wall
  const p2x = IW - 30;
  ctx.fillStyle = P.posterBg;
  ctx.fillRect(p2x, py, 16, 22);
  ctx.fillStyle = P.screenGlow;
  ctx.font = '7px monospace';
  ctx.fillText('{', p2x + 3, py + 10);
  ctx.fillText('}', p2x + 8, py + 18);
}

// =============================================================================
// WORK STATIONS
// =============================================================================
function drawWhiteboard(ctx: CanvasRenderingContext2D, t: number, mode: Mode): void {
  const { x, y, width, height } = STATIONS.whiteboard;
  const bx = x - width / 2;
  const by = y - height / 2;

  // Dim when not thinking
  if (mode !== 'thinking') ctx.globalAlpha = 0.6;

  // Shadow
  ctx.fillStyle = P.shadowLight;
  ctx.fillRect(bx + 2, by + 2, width, height);

  // Frame
  ctx.fillStyle = P.boardFrame;
  ctx.fillRect(bx - 3, by - 3, width + 6, height + 6);

  // Board surface
  ctx.fillStyle = P.boardSurface;
  ctx.fillRect(bx, by, width, height);

  // Marker tray
  ctx.fillStyle = P.boardFrameDark;
  ctx.fillRect(bx, by + height, width, 4);

  // Markers
  const markers = [P.markerBlue, P.stickyGreen, P.errorGlow, P.markerPurple];
  for (let i = 0; i < markers.length; i++) {
    ctx.fillStyle = markers[i];
    ctx.fillRect(bx + 8 + i * 12, by + height + 1, 8, 2);
  }

  // Sticky notes with sway
  const sway = Math.sin(t / ANIM.stickyNoteSway) * 0.5;
  const notes = [
    { nx: 8, ny: 5, color: P.stickyYellow },
    { nx: 25, ny: 8, color: P.stickyPink },
    { nx: 45, ny: 5, color: P.stickyBlue },
    { nx: 18, ny: 25, color: P.stickyGreen },
  ];
  for (const note of notes) {
    ctx.save();
    ctx.translate(bx + note.nx + 5, by + note.ny);
    ctx.rotate(sway * 0.02 + (note.nx % 3 - 1) * 0.05);
    ctx.fillStyle = note.color;
    ctx.fillRect(-5, 0, 12, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-3, 4, 8, 1);
    ctx.fillRect(-3, 7, 6, 1);
    ctx.restore();
  }

  // Thinking mode: building diagram
  if (mode === 'thinking') {
    ctx.strokeStyle = P.markerBlue;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 12, by + 18, 14, 10);
    ctx.strokeRect(bx + 42, by + 18, 14, 10);
    ctx.strokeRect(bx + 27, by + 32, 14, 10);

    ctx.beginPath();
    ctx.moveTo(bx + 26, by + 28);
    ctx.lineTo(bx + 34, by + 32);
    ctx.moveTo(bx + 42, by + 28);
    ctx.lineTo(bx + 34, by + 32);
    ctx.stroke();

    // Animated question mark
    const qAlpha = 0.5 + Math.sin(t / 300) * 0.5;
    ctx.fillStyle = `rgba(128,90,213,${qAlpha})`;
    ctx.font = '10px monospace';
    ctx.fillText('?', bx + 58, by + 42);
  }

  ctx.globalAlpha = 1;
}

function drawServerRack(ctx: CanvasRenderingContext2D, t: number, mode: Mode): void {
  const { x, y, width, height } = STATIONS.serverRack;

  // Shadow
  ctx.fillStyle = P.shadow;
  ctx.fillRect(x + 2, y + 2, width, height);

  // Rack frame
  ctx.fillStyle = P.serverDark;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = P.serverMid;
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);

  // Server units (5 units for taller portrait)
  const unitHeight = 9;
  const gap = 2;
  for (let i = 0; i < 5; i++) {
    const uy = y + 4 + i * (unitHeight + gap);

    // Unit body
    ctx.fillStyle = P.serverDark;
    ctx.fillRect(x + 3, uy, width - 6, unitHeight);
    ctx.fillStyle = P.serverLight;
    ctx.fillRect(x + 4, uy + 1, width - 8, unitHeight - 2);

    // Vents
    ctx.fillStyle = P.serverDark;
    for (let v = 0; v < 2; v++) {
      ctx.fillRect(x + 6 + v * 8, uy + 3, 5, 1);
      ctx.fillRect(x + 6 + v * 8, uy + 5, 5, 1);
    }

    // LED indicators
    for (let led = 0; led < 2; led++) {
      let ledColor = P.serverLEDOff;

      if (mode === 'running') {
        const scanPos = Math.floor(t / ANIM.ledScan) % 10;
        const ledIdx = i * 2 + led;
        if (scanPos === ledIdx || scanPos === ledIdx + 1) {
          ledColor = P.serverLED;
        }
      } else if (mode === 'error') {
        ledColor = Math.floor(t / 200) % 2 === 0 ? P.serverError : P.serverLEDOff;
      } else if (mode === 'celebrate') {
        ledColor = P.serverLED;
      } else {
        ledColor = Math.sin(t / 1000 + i) > 0.5 ? P.serverLED : P.serverLEDOff;
      }

      ctx.fillStyle = ledColor;
      ctx.fillRect(x + width - 8, uy + 2 + led * 3, 3, 2);
    }
  }

  // Glow when running
  if (mode === 'running') {
    const intensity = 0.15 + Math.sin(t / 150) * 0.08;
    ctx.fillStyle = `rgba(0,255,136,${intensity})`;
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // Error glow
  if (mode === 'error') {
    const intensity = 0.1 + Math.sin(t / 100) * 0.05;
    ctx.fillStyle = `rgba(245,101,101,${intensity})`;
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBookshelf(ctx: CanvasRenderingContext2D): void {
  const x = 12;
  const y = 140;
  const w = 22;
  const h = 50;

  // Shadow
  ctx.fillStyle = P.shadowLight;
  ctx.fillRect(x + 2, y + 2, w, h);

  // Shelf frame
  ctx.fillStyle = P.shelfWoodDark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = P.shelfWood;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

  // Shelves (4 levels)
  const shelfGap = h / 4;
  for (let i = 1; i < 4; i++) {
    ctx.fillStyle = P.shelfWoodDark;
    ctx.fillRect(x + 2, y + i * shelfGap, w - 4, 2);
  }

  // Books
  const bookColors = [P.bookRed, P.bookBlue, P.bookGreen, P.bookYellow, P.bookPurple];
  for (let shelf = 0; shelf < 4; shelf++) {
    const shelfY = y + 3 + shelf * shelfGap;
    const shelfH = shelfGap - 5;
    let bx = x + 3;
    for (let b = 0; b < 4; b++) {
      const bw = 3 + (b % 2);
      if (bx + bw > x + w - 3) break;
      ctx.fillStyle = bookColors[(shelf + b) % bookColors.length];
      ctx.fillRect(bx, shelfY, bw, shelfH);
      bx += bw + 1;
    }
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, t: number, mode: Mode): void {
  const px = 22;
  const py = 250;

  // Pot shadow
  ctx.fillStyle = P.shadowLight;
  ctx.beginPath();
  ctx.ellipse(px, py + 1, 8, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pot
  ctx.fillStyle = P.potTerracotta;
  ctx.fillRect(px - 6, py - 12, 12, 12);
  ctx.fillStyle = P.potTerracottaDark;
  ctx.fillRect(px - 8, py - 14, 16, 3);

  // Plant
  const sway = Math.sin(t / ANIM.plantSway) * (mode === 'running' ? 2 : 1);
  const droop = mode === 'error' ? 2 : 0;

  ctx.fillStyle = P.leafGreenDark;
  ctx.fillRect(px - 1, py - 22, 2, 10);

  const leaves = [
    { ox: -8, oy: -24, rx: 6, ry: 2.5 },
    { ox: 8, oy: -22, rx: 6, ry: 2.5 },
    { ox: 0, oy: -28, rx: 5, ry: 2.5 },
  ];

  for (const leaf of leaves) {
    ctx.fillStyle = P.leafGreen;
    ctx.beginPath();
    ctx.ellipse(px + leaf.ox + sway * 0.5, py + leaf.oy + droop, leaf.rx, leaf.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.leafHighlight;
    ctx.beginPath();
    ctx.ellipse(px + leaf.ox + sway * 0.5 - 2, py + leaf.oy + droop - 1, leaf.rx * 0.4, leaf.ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDesk(ctx: CanvasRenderingContext2D, t: number, mode: Mode): void {
  const dx = STATIONS.desk.x;
  const dy = STATIONS.desk.y;
  const dw = 70;
  const dh = 20;

  // Desk shadow
  ctx.fillStyle = P.shadowLight;
  ctx.fillRect(dx - dw / 2 + 3, dy + 3, dw, dh);

  // Desk top
  ctx.fillStyle = P.deskLight;
  ctx.fillRect(dx - dw / 2, dy - 2, dw, 4);
  ctx.fillStyle = P.deskHighlight;
  ctx.fillRect(dx - dw / 2, dy - 2, dw, 1);

  // Desk front
  ctx.fillStyle = P.deskMid;
  ctx.fillRect(dx - dw / 2, dy + 2, dw, dh - 2);
  ctx.fillStyle = P.deskDark;
  ctx.fillRect(dx - dw / 2, dy + dh - 2, dw, 2);

  // Drawer
  ctx.strokeStyle = P.deskDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(dx - 15, dy + 5, 30, 10);
  ctx.fillStyle = P.deskDark;
  ctx.fillRect(dx - 3, dy + 9, 6, 2);

  // Monitor
  drawMonitor(ctx, dx, dy - 28, t, mode);

  // Keyboard
  drawKeyboard(ctx, dx, dy - 4, t, mode);

  // Coffee mug
  drawCoffeeMug(ctx, dx + 28, dy - 6, t);

  // Papers
  ctx.fillStyle = P.paper;
  ctx.fillRect(dx - 28, dy - 5, 8, 10);
  ctx.fillStyle = P.stickyYellow;
  ctx.fillRect(dx - 26, dy - 3, 5, 5);
}

function drawMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, mode: Mode): void {
  const mw = 30;
  const mh = 22;

  // Frame
  ctx.fillStyle = P.monitorFrame;
  ctx.fillRect(x - mw / 2 - 2, y - 2, mw + 4, mh + 4);

  // Screen
  ctx.fillStyle = P.monitorScreen;
  ctx.fillRect(x - mw / 2, y, mw, mh);

  // Content by mode
  if (mode === 'typing' || mode === 'idle') {
    ctx.fillStyle = P.screenGlow;
    const lines = [5, 12, 16, 9, 14, 6, 11];
    for (let i = 0; i < lines.length; i++) {
      const lw = lines[i];
      const animated = mode === 'typing' && i === lines.length - 1;
      const displayW = animated ? lw * (0.5 + Math.sin(t / 150) * 0.5) : lw;
      ctx.fillRect(x - mw / 2 + 2, y + 2 + i * 3, displayW, 2);
    }
    if (mode === 'typing' && Math.floor(t / 300) % 2 === 0) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - mw / 2 + 2 + lines[lines.length - 1], y + 2 + (lines.length - 1) * 3, 2, 2);
    }
  } else if (mode === 'running') {
    ctx.fillStyle = P.screenGlow;
    const offset = Math.floor(t / 80) % 6;
    for (let i = 0; i < 6; i++) {
      const lineY = y + 2 + ((i + offset) % 6) * 3;
      ctx.fillRect(x - mw / 2 + 2, lineY, 8 + ((i * 7) % 12), 2);
    }
  } else if (mode === 'celebrate') {
    ctx.strokeStyle = P.screenGlow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 12);
    ctx.lineTo(x - 3, y + 18);
    ctx.lineTo(x + 11, y + 5);
    ctx.stroke();
  } else if (mode === 'error') {
    ctx.strokeStyle = P.errorGlow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 5);
    ctx.lineTo(x + 9, y + 18);
    ctx.moveTo(x + 9, y + 5);
    ctx.lineTo(x - 9, y + 18);
    ctx.stroke();
  } else if (mode === 'thinking') {
    ctx.fillStyle = P.screenGlowDim;
    ctx.fillRect(x - mw / 2, y, mw, mh);
    ctx.fillStyle = P.screenGlow;
    const dotFrame = Math.floor(t / 400) % 4;
    for (let i = 0; i < 3; i++) {
      if (i < dotFrame) ctx.fillRect(x - 6 + i * 5, y + 10, 3, 3);
    }
  }

  // Stand
  ctx.fillStyle = P.monitorFrame;
  ctx.fillRect(x - 4, y + mh + 2, 8, 4);
  ctx.fillRect(x - 8, y + mh + 5, 16, 2);
}

function drawKeyboard(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, mode: Mode): void {
  ctx.fillStyle = P.chairMid;
  ctx.fillRect(x - 14, y, 28, 6);

  ctx.fillStyle = P.chairDark;
  const rows = [
    [-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10],
    [-11, -9, -7, -5, -3, -1, 1, 3, 5, 7, 9],
    [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8],
  ];
  const typingKey = mode === 'typing' ? Math.floor(t / ANIM.typing) % 25 : -1;
  let keyIdx = 0;
  for (let row = 0; row < rows.length; row++) {
    for (const kx of rows[row]) {
      const pressed = keyIdx === typingKey;
      ctx.fillRect(x + kx, y + 1 + row * 1.8 + (pressed ? 0.5 : 0), 1.5, 1);
      keyIdx++;
    }
  }
}

function drawCoffeeMug(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  ctx.fillStyle = P.mugBody;
  ctx.fillRect(x - 4, y, 8, 7);
  ctx.strokeStyle = P.mugBody;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + 5, y + 3, 3, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = P.coffeeDark;
  ctx.fillRect(x - 3, y + 1, 6, 2);

  // Steam
  ctx.strokeStyle = P.steam;
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    const steamOffset = (t / ANIM.steamRise + i * 4) % 8;
    ctx.beginPath();
    ctx.moveTo(x - 1 + i * 2, y - steamOffset);
    ctx.quadraticCurveTo(x - 1 + i * 2 + Math.sin(t / 300 + i) * 1.5, y - 4 - steamOffset, x - 1 + i * 2, y - 8 - steamOffset);
    ctx.stroke();
  }
}

// =============================================================================
// CELEBRATION AREA
// =============================================================================
function drawSofa(ctx: CanvasRenderingContext2D): void {
  const sx = STATIONS.lounge.sofaX;
  const sy = STATIONS.lounge.y;

  // Shadow
  ctx.fillStyle = P.shadowLight;
  ctx.fillRect(sx - 2 + 2, sy + 14, 36, 4);

  // Back
  ctx.fillStyle = P.sofaDark;
  ctx.fillRect(sx - 2, sy - 2, 36, 10);
  ctx.fillStyle = P.sofaMid;
  ctx.fillRect(sx - 2, sy - 2, 36, 3);

  // Seat
  ctx.fillStyle = P.sofaMid;
  ctx.fillRect(sx - 4, sy + 8, 40, 8);
  ctx.fillStyle = P.sofaDark;
  ctx.fillRect(sx + 11, sy + 9, 1, 6);
  ctx.fillRect(sx + 23, sy + 9, 1, 6);

  // Armrests
  ctx.fillStyle = P.sofaLight;
  ctx.fillRect(sx - 6, sy + 3, 4, 13);
  ctx.fillRect(sx + 34, sy + 3, 4, 13);

  // Legs
  ctx.fillStyle = P.chairDark;
  ctx.fillRect(sx, sy + 16, 3, 4);
  ctx.fillRect(sx + 31, sy + 16, 3, 4);
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, t: number, mode: Mode): void {
  const mx = STATIONS.lounge.sofaX + 44;
  const my = STATIONS.lounge.y - 5;

  ctx.fillStyle = P.machineDark;
  ctx.fillRect(mx, my, 16, 22);
  ctx.fillStyle = P.machineMid;
  ctx.fillRect(mx + 2, my + 2, 12, 12);
  ctx.fillStyle = P.monitorScreen;
  ctx.fillRect(mx + 3, my + 3, 10, 5);
  ctx.fillStyle = mode === 'celebrate' ? P.screenGlow : P.serverLEDOff;
  ctx.fillRect(mx + 4, my + 4, 2, 2);
  ctx.fillStyle = P.machineMid;
  ctx.fillRect(mx + 4, my + 10, 3, 2);
  ctx.fillRect(mx + 9, my + 10, 3, 2);
  ctx.fillStyle = P.machineDark;
  ctx.fillRect(mx + 4, my + 14, 8, 6);
  ctx.fillStyle = P.mugBody;
  ctx.fillRect(mx + 5, my + 16, 5, 4);

  if (mode === 'celebrate') {
    ctx.strokeStyle = P.steam;
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const steamY = my + 12 - (t / 150 + i * 5) % 8;
      ctx.beginPath();
      ctx.moveTo(mx + 7 + i * 2, steamY + 4);
      ctx.quadraticCurveTo(mx + 7 + i * 2 + Math.sin(t / 200) * 2, steamY, mx + 7 + i * 2, steamY - 4);
      ctx.stroke();
    }
  }
}

function drawGong(ctx: CanvasRenderingContext2D, t: number, mode: Mode): void {
  const gx = STATIONS.lounge.gongX;
  const gy = STATIONS.lounge.y;

  // Stand
  ctx.fillStyle = P.gongStand;
  ctx.fillRect(gx - 8, gy + 14, 16, 3);
  ctx.fillRect(gx - 6, gy - 4, 3, 18);
  ctx.fillRect(gx + 3, gy - 4, 3, 18);
  ctx.fillRect(gx - 7, gy - 6, 14, 3);

  // Gong disc
  const ringOffset = mode === 'celebrate' ? Math.sin(t / ANIM.gongRing) * 2 : 0;

  ctx.fillStyle = P.gongGoldDark;
  ctx.beginPath();
  ctx.arc(gx + ringOffset * 0.5, gy + 5, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = P.gongGold;
  ctx.beginPath();
  ctx.arc(gx + ringOffset, gy + 4, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = P.gongGoldLight;
  ctx.beginPath();
  ctx.arc(gx - 2 + ringOffset, gy + 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Vibration rings
  if (mode === 'celebrate') {
    for (let i = 0; i < 3; i++) {
      const ringAge = (t / 200 + i * 0.5) % 2;
      const ringRadius = 10 + ringAge * 8;
      const ringAlpha = Math.max(0, 0.4 - ringAge * 0.2);
      ctx.strokeStyle = `rgba(214,158,46,${ringAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(gx, gy + 4, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawWastebasket(ctx: CanvasRenderingContext2D, mode: Mode, t: number): void {
  const wx = IW - 28;
  const wy = 248;

  ctx.fillStyle = P.basketDark;
  ctx.fillRect(wx - 5, wy, 10, 10);
  ctx.fillStyle = P.basketMid;
  ctx.fillRect(wx - 6, wy - 1, 12, 2);

  if (mode === 'error') {
    const papers = [{ ox: -2, oy: -4 }, { ox: 2, oy: -6 }, { ox: 0, oy: -8 }];
    for (let i = 0; i < papers.length; i++) {
      const wobble = Math.sin(t / 200 + i) * 0.5;
      ctx.fillStyle = i % 2 === 0 ? P.paper : P.paperCrumpled;
      ctx.beginPath();
      ctx.arc(wx + papers[i].ox + wobble, wy + papers[i].oy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// =============================================================================
// CHARACTER
// =============================================================================
function getTargetPosition(mode: Mode): { x: number; y: number } {
  switch (mode) {
    case 'thinking':
      return STATIONS.whiteboard.charPos;
    case 'running':
      return STATIONS.serverRack.charPos;
    case 'typing':
      return STATIONS.desk.charPos;
    case 'celebrate':
      return STATIONS.lounge.charPos;
    case 'error':
      return STATIONS.desk.charPos;
    default:
      return STATIONS.idle.charPos;
  }
}

function updateCharacterPosition(target: { x: number; y: number }): void {
  const dx = target.x - currentX;
  const dy = target.y - currentY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > MOVE_SPEED) {
    currentX += (dx / dist) * MOVE_SPEED;
    currentY += (dy / dist) * MOVE_SPEED;
  } else {
    currentX = target.x;
    currentY = target.y;
  }
}

function drawCharacter(ctx: CanvasRenderingContext2D, t: number, mode: Mode): void {
  const x = currentX;
  const y = currentY;
  const animFrame = Math.floor(t / 200) % 4;

  let bodyOffset = 0;
  let armOffset = 0;
  let legOffset = 0;

  const target = getTargetPosition(mode);
  const isWalking = Math.abs(target.x - x) > 2 || Math.abs(target.y - y) > 2;

  if (isWalking) {
    legOffset = Math.sin(t / ANIM.walkCycle) * 3;
    armOffset = Math.sin(t / ANIM.walkCycle + Math.PI) * 2;
  } else if (mode === 'typing') {
    armOffset = animFrame % 2 === 0 ? -1 : 1;
  } else if (mode === 'running') {
    bodyOffset = Math.sin(t / 300) * 1;
  } else if (mode === 'thinking') {
    armOffset = -3;
  } else if (mode === 'celebrate') {
    bodyOffset = -Math.abs(Math.sin(t / 150) * 4);
    armOffset = -5;
  } else if (mode === 'error') {
    bodyOffset = animFrame % 2;
    armOffset = animFrame % 2 === 0 ? 2 : -2;
  }

  const baseY = y + bodyOffset;

  // Shadow
  ctx.fillStyle = P.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = P.pantsDark;
  ctx.fillRect(x - 3, baseY - 10, 3, 9 + Math.abs(legOffset / 2));
  ctx.fillRect(x, baseY - 10, 3, 9 - Math.abs(legOffset / 2));

  // Shoes
  ctx.fillStyle = P.shoes;
  ctx.fillRect(x - 4, baseY - 1 + (legOffset > 0 ? legOffset / 2 : 0), 4, 2);
  ctx.fillRect(x, baseY - 1 + (legOffset < 0 ? -legOffset / 2 : 0), 4, 2);

  // Body
  ctx.fillStyle = P.shirtBlue;
  ctx.fillRect(x - 4, baseY - 19, 9, 10);
  ctx.fillStyle = P.shirtBlueDark;
  ctx.fillRect(x - 4, baseY - 19, 2, 10);

  // Arms
  ctx.fillStyle = P.shirtBlue;
  ctx.fillRect(x - 7, baseY - 17 + armOffset, 3, 7);
  ctx.fillRect(x + 4, baseY - 17 + (mode === 'thinking' ? 0 : armOffset), 3, 7);

  // Hands
  ctx.fillStyle = P.skin;
  ctx.fillRect(x - 7, baseY - 10 + armOffset, 3, 2);
  ctx.fillRect(x + 4, baseY - 10 + (mode === 'thinking' ? -4 : armOffset), 3, 2);

  // Head
  ctx.fillStyle = P.skin;
  ctx.fillRect(x - 4, baseY - 27, 9, 8);

  // Hair
  ctx.fillStyle = P.hair;
  ctx.fillRect(x - 5, baseY - 29, 10, 3);
  ctx.fillRect(x - 5, baseY - 27, 2, 2);
  ctx.fillRect(x + 4, baseY - 27, 2, 2);

  // Eyes
  ctx.fillStyle = '#1a202c';
  const blink = Math.floor(t / ANIM.blink) % 10;
  if (blink !== 0) {
    ctx.fillRect(x - 2, baseY - 24, 2, 2);
    ctx.fillRect(x + 1, baseY - 24, 2, 2);
  } else {
    ctx.fillRect(x - 2, baseY - 23, 2, 1);
    ctx.fillRect(x + 1, baseY - 23, 2, 1);
  }

  // Mouth
  if (mode === 'celebrate') {
    ctx.fillStyle = '#c53030';
    ctx.fillRect(x - 1, baseY - 21, 3, 1);
    ctx.fillRect(x, baseY - 20, 1, 1);
  } else if (mode === 'error') {
    ctx.fillStyle = '#c53030';
    ctx.fillRect(x, baseY - 20, 1, 1);
    ctx.fillRect(x - 1, baseY - 21, 1, 1);
    ctx.fillRect(x + 1, baseY - 21, 1, 1);
  } else {
    ctx.fillStyle = '#8b6b5a';
    ctx.fillRect(x - 1, baseY - 21, 2, 1);
  }

  // Mode effects
  if (mode === 'typing' && !isWalking) {
    const dotFrame = Math.floor(t / 120) % 4;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < dotFrame ? P.screenGlow : 'rgba(0,255,136,0.3)';
      ctx.fillRect(x + 10 + i * 4, baseY - 23, 2, 2);
    }
  } else if (mode === 'thinking' && !isWalking) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x + 15, baseY - 36, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 8, baseY - 29, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 5, baseY - 26, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = P.markerPurple;
    ctx.font = 'bold 7px monospace';
    ctx.fillText(['?', '...', '!'][Math.floor(t / 400) % 3], x + 11, baseY - 34);
  } else if (mode === 'celebrate' && !isWalking) {
    ctx.fillStyle = P.celebrateGlow;
    const starY = baseY - 36 - Math.sin(t / 200) * 3;
    drawStar(ctx, x - 7, starY, 4);
    drawStar(ctx, x, starY - 4, 5);
    drawStar(ctx, x + 7, starY, 4);
  } else if (mode === 'error' && !isWalking) {
    ctx.fillStyle = P.errorGlow;
    ctx.fillRect(x - 1, baseY - 42, 3, 7);
    ctx.fillRect(x - 1, baseY - 33, 3, 2);

    ctx.fillStyle = '#90cdf4';
    ctx.beginPath();
    ctx.moveTo(x + 7, baseY - 26);
    ctx.lineTo(x + 9, baseY - 22);
    ctx.lineTo(x + 5, baseY - 22);
    ctx.closePath();
    ctx.fill();
  } else if (mode === 'running' && !isWalking) {
    ctx.strokeStyle = 'rgba(237,137,54,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const ly = baseY - 23 + i * 4;
      ctx.beginPath();
      ctx.moveTo(x - 13 - i * 2, ly);
      ctx.lineTo(x - 7, ly);
      ctx.stroke();
    }
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillRect(x - size / 2, y - 1, size, 2);
  ctx.fillRect(x - 1, y - size / 2, 2, size);
}

// =============================================================================
// EFFECTS
// =============================================================================
function drawLighting(ctx: CanvasRenderingContext2D, mode: Mode, t: number): void {
  if (mode === 'running') {
    const intensity = 0.08 + Math.sin(t / 200) * 0.03;
    ctx.fillStyle = `rgba(255,180,100,${intensity})`;
    ctx.fillRect(0, 0, IW, IH);
  } else if (mode === 'error') {
    const intensity = 0.06 + Math.sin(t / 150) * 0.03;
    ctx.fillStyle = `rgba(245,101,101,${intensity})`;
    ctx.fillRect(0, 0, IW, IH);
  } else if (mode === 'celebrate') {
    const intensity = 0.05 + Math.sin(t / 100) * 0.02;
    ctx.fillStyle = `rgba(246,224,94,${intensity})`;
    ctx.fillRect(0, 0, IW, IH);
  } else if (mode === 'thinking') {
    ctx.fillStyle = 'rgba(100,150,255,0.04)';
    ctx.fillRect(0, 0, IW, IH);
  }

  // Dim inactive areas like ramen stall does
  if (mode !== 'thinking') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 50, IW, 90); // whiteboard area
  }
}

function drawConfetti(ctx: CanvasRenderingContext2D, t: number): void {
  for (let i = 0; i < 20; i++) {
    const seed = i * 137.5;
    const x = (seed + t / 20) % IW;
    const y = ((seed * 2.3 + t / ANIM.confetti) % (IH + 20)) - 10;
    const colorIdx = i % P.confetti.length;
    const rotation = (t / 100 + seed) % (Math.PI * 2);
    const size = 2 + (i % 3);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = P.confetti[colorIdx];
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);
    ctx.restore();
  }
}

function drawVignette(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createRadialGradient(IW / 2, IH / 2, IH * 0.25, IW / 2, IH / 2, IH * 0.65);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, IW, IH);
}

function drawStatus(ctx: CanvasRenderingContext2D, mode: Mode): void {
  const modeColors: Record<Mode, string> = {
    idle: '#4a5568',
    typing: '#48bb78',
    running: '#ed8936',
    thinking: '#805ad5',
    celebrate: '#f6e05e',
    error: '#f56565',
  };

  const names: Record<Mode, string> = {
    idle: 'IDLE',
    typing: 'CODE',
    running: 'RUN',
    thinking: 'READ',
    celebrate: 'DONE',
    error: 'OOPS',
  };

  ctx.fillStyle = 'rgba(6,21,34,0.85)';
  ctx.fillRect(4, IH - 14, 40, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(4, IH - 14, 40, 1);
  ctx.fillRect(4, IH - 5, 40, 1);
  ctx.fillRect(4, IH - 14, 1, 10);
  ctx.fillRect(43, IH - 14, 1, 10);

  ctx.fillStyle = modeColors[mode];
  ctx.fillRect(6, IH - 11, 4, 4);

  ctx.fillStyle = '#f2c14e';
  ctx.font = '5px monospace';
  ctx.fillText(names[mode], 12, IH - 7);
}
