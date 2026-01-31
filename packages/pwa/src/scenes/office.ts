import type { Mode } from '../types';
import { ART_CONFIG } from '../types';
import { clearCanvas } from '../engine/canvas';
import { createCharacter, updateCharacter, drawCharacter, MODE_COLORS } from '../engine/sprites';

const { internalWidth, internalHeight } = ART_CONFIG;

// Scene positions
const DESK_X = internalWidth / 2;
const DESK_Y = internalHeight - 40;
const DESK_WIDTH = 60;
const DESK_HEIGHT = 20;

const WHITEBOARD_X = 40;
const WHITEBOARD_Y = 30;
const WHITEBOARD_WIDTH = 50;
const WHITEBOARD_HEIGHT = 35;

const TERMINAL_X = internalWidth - 50;
const TERMINAL_Y = internalHeight - 50;
const TERMINAL_WIDTH = 35;
const TERMINAL_HEIGHT = 25;

const WINDOW_X = internalWidth - 60;
const WINDOW_Y = 20;
const WINDOW_WIDTH = 40;
const WINDOW_HEIGHT = 50;

// Character positions for each mode
const POSITIONS = {
  desk: { x: DESK_X, y: DESK_Y - 5 },
  whiteboard: { x: WHITEBOARD_X + 25, y: WHITEBOARD_Y + 60 },
  terminal: { x: TERMINAL_X + 10, y: TERMINAL_Y + 30 },
};

// Character with smooth movement
const character = createCharacter(DESK_X, DESK_Y - 5);
let targetX = DESK_X;
let targetY = DESK_Y - 5;
let currentX = DESK_X;
let currentY = DESK_Y - 5;
const MOVE_SPEED = 1.5;

// Colors
const COLORS = {
  floor: '#2d3748',
  wall: '#1a202c',
  desk: '#4a3728',
  deskTop: '#5d4a3a',
  whiteboard: '#e2e8f0',
  whiteboardFrame: '#4a5568',
  terminal: '#1a1a2e',
  terminalScreen: '#0d1117',
  terminalGlow: '#00ff88',
  window: '#4a6fa5',
  windowFrame: '#2d3748',
  plant: '#48bb78',
  pot: '#c53030',
  coffee: '#c4a77d',
  steam: 'rgba(255, 255, 255, 0.3)',
};

export function drawOffice(ctx: CanvasRenderingContext2D, mode: Mode, time: number): void {
  // Clear with wall color
  clearCanvas(ctx, COLORS.wall);

  // Draw floor
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(0, internalHeight - 50, internalWidth, 50);

  // Draw floor pattern (simple tiles)
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  for (let x = 0; x < internalWidth; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, internalHeight - 50);
    ctx.lineTo(x, internalHeight);
    ctx.stroke();
  }

  // Draw window
  drawWindow(ctx, time);

  // Draw whiteboard
  drawWhiteboard(ctx, mode, time);

  // Draw terminal
  drawTerminal(ctx, mode, time);

  // Draw desk with monitor
  drawDesk(ctx, mode, time);

  // Draw chair
  drawChair(ctx);

  // Draw plant
  drawPlant(ctx, time);

  // Draw coffee
  drawCoffee(ctx, time);

  // Update character position based on mode
  if (mode === 'thinking') {
    targetX = POSITIONS.whiteboard.x;
    targetY = POSITIONS.whiteboard.y;
  } else if (mode === 'running') {
    targetX = POSITIONS.terminal.x;
    targetY = POSITIONS.terminal.y;
  } else {
    targetX = POSITIONS.desk.x;
    targetY = POSITIONS.desk.y;
  }

  // Smooth movement
  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > MOVE_SPEED) {
    currentX += (dx / dist) * MOVE_SPEED;
    currentY += (dy / dist) * MOVE_SPEED;
  } else {
    currentX = targetX;
    currentY = targetY;
  }

  character.x = currentX;
  character.y = currentY;

  // Update and draw character
  updateCharacter(character, mode);
  drawCharacter(ctx, character, time);

  // Draw mode indicator (debug/MVP)
  drawModeIndicator(ctx, mode);
}

function drawWindow(ctx: CanvasRenderingContext2D, time: number): void {
  // Frame
  ctx.fillStyle = COLORS.windowFrame;
  ctx.fillRect(WINDOW_X - 3, WINDOW_Y - 3, WINDOW_WIDTH + 6, WINDOW_HEIGHT + 6);

  // Sky gradient effect
  const gradient = ctx.createLinearGradient(WINDOW_X, WINDOW_Y, WINDOW_X, WINDOW_Y + WINDOW_HEIGHT);
  gradient.addColorStop(0, '#1e3a5f');
  gradient.addColorStop(1, '#4a6fa5');
  ctx.fillStyle = gradient;
  ctx.fillRect(WINDOW_X, WINDOW_Y, WINDOW_WIDTH, WINDOW_HEIGHT);

  // Stars
  ctx.fillStyle = '#fff';
  const starPositions = [[5, 10], [15, 5], [30, 15], [25, 8], [10, 25]];
  for (const [sx, sy] of starPositions) {
    const twinkle = Math.sin(time / 500 + sx) > 0.5;
    if (twinkle) {
      ctx.fillRect(WINDOW_X + sx, WINDOW_Y + sy, 1, 1);
    }
  }

  // Window panes
  ctx.strokeStyle = COLORS.windowFrame;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(WINDOW_X + WINDOW_WIDTH / 2, WINDOW_Y);
  ctx.lineTo(WINDOW_X + WINDOW_WIDTH / 2, WINDOW_Y + WINDOW_HEIGHT);
  ctx.moveTo(WINDOW_X, WINDOW_Y + WINDOW_HEIGHT / 2);
  ctx.lineTo(WINDOW_X + WINDOW_WIDTH, WINDOW_Y + WINDOW_HEIGHT / 2);
  ctx.stroke();
}

function drawWhiteboard(ctx: CanvasRenderingContext2D, mode: Mode, time: number): void {
  // Frame
  ctx.fillStyle = COLORS.whiteboardFrame;
  ctx.fillRect(WHITEBOARD_X - 3, WHITEBOARD_Y - 3, WHITEBOARD_WIDTH + 6, WHITEBOARD_HEIGHT + 6);

  // Board
  ctx.fillStyle = COLORS.whiteboard;
  ctx.fillRect(WHITEBOARD_X, WHITEBOARD_Y, WHITEBOARD_WIDTH, WHITEBOARD_HEIGHT);

  // Content based on mode
  if (mode === 'thinking') {
    // Draw thought diagram
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;

    // Boxes
    ctx.strokeRect(WHITEBOARD_X + 5, WHITEBOARD_Y + 5, 15, 10);
    ctx.strokeRect(WHITEBOARD_X + 30, WHITEBOARD_Y + 5, 15, 10);
    ctx.strokeRect(WHITEBOARD_X + 17, WHITEBOARD_Y + 20, 15, 10);

    // Lines
    ctx.beginPath();
    ctx.moveTo(WHITEBOARD_X + 20, WHITEBOARD_Y + 15);
    ctx.lineTo(WHITEBOARD_X + 25, WHITEBOARD_Y + 20);
    ctx.moveTo(WHITEBOARD_X + 30, WHITEBOARD_Y + 15);
    ctx.lineTo(WHITEBOARD_X + 25, WHITEBOARD_Y + 20);
    ctx.stroke();

    // Animated question mark
    if (Math.floor(time / 500) % 2 === 0) {
      ctx.fillStyle = '#805ad5';
      ctx.font = '8px monospace';
      ctx.fillText('?', WHITEBOARD_X + 40, WHITEBOARD_Y + 30);
    }
  } else {
    // Simple lines
    ctx.strokeStyle = '#a0aec0';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = WHITEBOARD_Y + 8 + i * 7;
      const width = 30 + (i % 2) * 10;
      ctx.beginPath();
      ctx.moveTo(WHITEBOARD_X + 5, y);
      ctx.lineTo(WHITEBOARD_X + 5 + width, y);
      ctx.stroke();
    }
  }
}

function drawTerminal(ctx: CanvasRenderingContext2D, mode: Mode, time: number): void {
  // Terminal body
  ctx.fillStyle = COLORS.terminal;
  ctx.fillRect(TERMINAL_X, TERMINAL_Y, TERMINAL_WIDTH, TERMINAL_HEIGHT);

  // Screen
  ctx.fillStyle = COLORS.terminalScreen;
  ctx.fillRect(TERMINAL_X + 3, TERMINAL_Y + 3, TERMINAL_WIDTH - 6, TERMINAL_HEIGHT - 8);

  // Screen glow when running
  if (mode === 'running') {
    ctx.fillStyle = `rgba(0, 255, 136, ${0.1 + Math.sin(time / 100) * 0.05})`;
    ctx.fillRect(TERMINAL_X + 3, TERMINAL_Y + 3, TERMINAL_WIDTH - 6, TERMINAL_HEIGHT - 8);

    // Scrolling text effect
    ctx.fillStyle = COLORS.terminalGlow;
    const offset = Math.floor(time / 100) % 5;
    for (let i = 0; i < 3; i++) {
      const y = TERMINAL_Y + 6 + ((i + offset) % 4) * 4;
      const width = 10 + (i * 5) % 15;
      ctx.fillRect(TERMINAL_X + 5, y, width, 2);
    }
  } else {
    // Static prompt
    ctx.fillStyle = COLORS.terminalGlow;
    ctx.fillRect(TERMINAL_X + 5, TERMINAL_Y + 6, 3, 2);
    ctx.fillRect(TERMINAL_X + 10, TERMINAL_Y + 6, 8, 2);

    // Blinking cursor
    if (Math.floor(time / 500) % 2 === 0) {
      ctx.fillRect(TERMINAL_X + 5, TERMINAL_Y + 12, 4, 2);
    }
  }

  // Stand
  ctx.fillStyle = COLORS.terminal;
  ctx.fillRect(TERMINAL_X + TERMINAL_WIDTH / 2 - 5, TERMINAL_Y + TERMINAL_HEIGHT - 2, 10, 4);
}

function drawDesk(ctx: CanvasRenderingContext2D, mode: Mode, time: number): void {
  // Desk top
  ctx.fillStyle = COLORS.deskTop;
  ctx.fillRect(DESK_X - DESK_WIDTH / 2, DESK_Y - 3, DESK_WIDTH, 5);

  // Desk front
  ctx.fillStyle = COLORS.desk;
  ctx.fillRect(DESK_X - DESK_WIDTH / 2, DESK_Y + 2, DESK_WIDTH, DESK_HEIGHT - 2);

  // Drawer
  ctx.strokeStyle = '#3d2f22';
  ctx.lineWidth = 1;
  ctx.strokeRect(DESK_X - 15, DESK_Y + 5, 30, 10);

  // Drawer handle
  ctx.fillStyle = '#2d2318';
  ctx.fillRect(DESK_X - 3, DESK_Y + 9, 6, 2);

  // Monitor
  const monitorX = DESK_X - 12;
  const monitorY = DESK_Y - 28;
  const monitorW = 24;
  const monitorH = 18;

  // Monitor frame
  ctx.fillStyle = '#2d3748';
  ctx.fillRect(monitorX - 2, monitorY - 2, monitorW + 4, monitorH + 4);

  // Screen
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(monitorX, monitorY, monitorW, monitorH);

  // Screen content based on mode
  if (mode === 'typing' || mode === 'idle') {
    // Code lines
    ctx.fillStyle = '#00ff88';
    const codeLines = [3, 8, 12, 6, 10, 4];
    for (let i = 0; i < codeLines.length; i++) {
      const lineWidth = codeLines[i];
      const animated = mode === 'typing' && i === codeLines.length - 1;
      const displayWidth = animated ? lineWidth * (0.5 + Math.sin(time / 200) * 0.5) : lineWidth;
      ctx.fillRect(monitorX + 2, monitorY + 2 + i * 2.5, displayWidth, 1.5);
    }

    // Cursor blink when typing
    if (mode === 'typing' && Math.floor(time / 300) % 2 === 0) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(monitorX + 2 + codeLines[codeLines.length - 1], monitorY + 2 + (codeLines.length - 1) * 2.5, 2, 2);
    }
  } else if (mode === 'celebrate') {
    // Checkmark
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(monitorX + 6, monitorY + 10);
    ctx.lineTo(monitorX + 10, monitorY + 14);
    ctx.lineTo(monitorX + 18, monitorY + 5);
    ctx.stroke();
  } else if (mode === 'error') {
    // Error X
    ctx.strokeStyle = '#f56565';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(monitorX + 6, monitorY + 5);
    ctx.lineTo(monitorX + 18, monitorY + 14);
    ctx.moveTo(monitorX + 18, monitorY + 5);
    ctx.lineTo(monitorX + 6, monitorY + 14);
    ctx.stroke();
  } else {
    // Default - dim screen
    ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
    ctx.fillRect(monitorX, monitorY, monitorW, monitorH);
  }

  // Monitor stand
  ctx.fillStyle = '#2d3748';
  ctx.fillRect(monitorX + monitorW / 2 - 3, monitorY + monitorH + 2, 6, 4);
  ctx.fillRect(monitorX + monitorW / 2 - 6, monitorY + monitorH + 5, 12, 2);

  // Keyboard
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(DESK_X - 10, DESK_Y - 6, 20, 4);
  ctx.fillStyle = '#2d3748';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(DESK_X - 8 + i * 6, DESK_Y - 5, 4, 2);
  }
}

function drawChair(ctx: CanvasRenderingContext2D): void {
  const chairX = DESK_X;
  const chairY = DESK_Y + 25;

  // Chair back
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(chairX - 10, chairY - 20, 20, 15);

  // Chair seat
  ctx.fillStyle = '#3d4852';
  ctx.fillRect(chairX - 12, chairY - 5, 24, 8);

  // Chair legs/base
  ctx.fillStyle = '#2d3748';
  ctx.fillRect(chairX - 2, chairY + 3, 4, 8);

  // Wheels
  ctx.fillStyle = '#1a202c';
  ctx.beginPath();
  ctx.arc(chairX - 8, chairY + 12, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(chairX + 8, chairY + 12, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlant(ctx: CanvasRenderingContext2D, time: number): void {
  const plantX = 25;
  const plantY = internalHeight - 50;

  // Pot
  ctx.fillStyle = COLORS.pot;
  ctx.fillRect(plantX - 8, plantY - 12, 16, 12);

  // Pot rim
  ctx.fillStyle = '#9b2c2c';
  ctx.fillRect(plantX - 10, plantY - 14, 20, 3);

  // Plant leaves
  ctx.fillStyle = COLORS.plant;
  const sway = Math.sin(time / 1000) * 1;

  // Center stem
  ctx.fillRect(plantX - 1, plantY - 25, 2, 12);

  // Leaves
  ctx.beginPath();
  ctx.ellipse(plantX - 8 + sway, plantY - 28, 6, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(plantX + 8 + sway, plantY - 26, 6, 3, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(plantX + sway / 2, plantY - 32, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoffee(ctx: CanvasRenderingContext2D, time: number): void {
  const coffeeX = internalWidth - 25;
  const coffeeY = internalHeight - 52;

  // Cup
  ctx.fillStyle = COLORS.coffee;
  ctx.fillRect(coffeeX - 5, coffeeY, 10, 8);

  // Handle
  ctx.strokeStyle = COLORS.coffee;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(coffeeX + 7, coffeeY + 4, 4, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Coffee inside
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(coffeeX - 4, coffeeY + 1, 8, 3);

  // Steam
  ctx.strokeStyle = COLORS.steam;
  ctx.lineWidth = 1;
  const steamOffset = (time / 200) % 10;
  for (let i = 0; i < 3; i++) {
    const sx = coffeeX - 2 + i * 2;
    const phase = i * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, coffeeY - 2 - steamOffset);
    ctx.quadraticCurveTo(
      sx + Math.sin(time / 300 + phase) * 2,
      coffeeY - 6 - steamOffset,
      sx,
      coffeeY - 10 - steamOffset
    );
    ctx.stroke();
  }
}

function drawModeIndicator(ctx: CanvasRenderingContext2D, mode: Mode): void {
  // Small indicator in corner (for MVP debugging)
  const indicatorX = 5;
  const indicatorY = 5;

  ctx.fillStyle = MODE_COLORS[mode];
  ctx.fillRect(indicatorX, indicatorY, 8, 8);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '6px monospace';
  ctx.fillText(mode.slice(0, 3).toUpperCase(), indicatorX + 12, indicatorY + 6);
}
