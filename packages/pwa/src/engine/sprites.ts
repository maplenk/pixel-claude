import type { Mode } from '../types';

// Placeholder colors for each mode (MVP - to be replaced with real sprites)
export const MODE_COLORS: Record<Mode, string> = {
  idle: '#4a5568',      // Gray
  typing: '#48bb78',    // Green
  running: '#ed8936',   // Orange
  thinking: '#805ad5',  // Purple
  celebrate: '#f6e05e', // Yellow
  error: '#f56565',     // Red
};

// Character colors
const SKIN = '#ffd9b3';
const HAIR = '#4a3728';
const SHIRT = '#3182ce';
const PANTS = '#2d3748';
const SHOES = '#1a202c';

// Animation timing
const ANIMATION_INTERVAL = 200; // ms between frames

export interface CharacterState {
  mode: Mode;
  frame: number;
  x: number;
  y: number;
}

export function createCharacter(x: number, y: number): CharacterState {
  return {
    mode: 'idle',
    frame: 0,
    x,
    y,
  };
}

export function updateCharacter(char: CharacterState, mode: Mode): void {
  if (char.mode !== mode) {
    char.mode = mode;
    char.frame = 0;
  }
}

// Draw pixel art character
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: CharacterState,
  time: number
): void {
  const animFrame = Math.floor(time / ANIMATION_INTERVAL) % 4;

  // Animation offsets based on mode
  let bodyOffset = 0;
  let armOffset = 0;
  let legOffset = 0;

  if (char.mode === 'typing') {
    armOffset = animFrame % 2 === 0 ? -1 : 1;
  } else if (char.mode === 'running') {
    bodyOffset = Math.sin(animFrame * Math.PI / 2) * 2;
    legOffset = animFrame % 2 === 0 ? 2 : -2;
  } else if (char.mode === 'thinking') {
    // Hand on chin pose
    armOffset = -3;
  } else if (char.mode === 'celebrate') {
    bodyOffset = -animFrame;
    armOffset = -4 - animFrame;
  } else if (char.mode === 'error') {
    bodyOffset = animFrame % 2;
  }

  const baseY = char.y + bodyOffset;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(char.x, char.y + 2, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = PANTS;
  ctx.fillRect(char.x - 4, baseY - 10, 3, 8 + Math.abs(legOffset / 2));
  ctx.fillRect(char.x + 1, baseY - 10, 3, 8 - Math.abs(legOffset / 2));

  // Shoes
  ctx.fillStyle = SHOES;
  ctx.fillRect(char.x - 5, baseY - 2 + (legOffset > 0 ? legOffset / 2 : 0), 4, 2);
  ctx.fillRect(char.x + 1, baseY - 2 + (legOffset < 0 ? -legOffset / 2 : 0), 4, 2);

  // Body (shirt)
  ctx.fillStyle = SHIRT;
  ctx.fillRect(char.x - 5, baseY - 20, 10, 12);

  // Arms
  ctx.fillStyle = SHIRT;
  // Left arm
  ctx.fillRect(char.x - 8, baseY - 18 + armOffset, 3, 8);
  // Right arm
  ctx.fillRect(char.x + 5, baseY - 18 + (char.mode === 'thinking' ? 0 : armOffset), 3, 8);

  // Hands
  ctx.fillStyle = SKIN;
  ctx.fillRect(char.x - 8, baseY - 10 + armOffset, 3, 3);
  ctx.fillRect(char.x + 5, baseY - 10 + (char.mode === 'thinking' ? -5 : armOffset), 3, 3);

  // Head
  ctx.fillStyle = SKIN;
  ctx.fillRect(char.x - 5, baseY - 30, 10, 10);

  // Hair
  ctx.fillStyle = HAIR;
  ctx.fillRect(char.x - 6, baseY - 32, 12, 4);
  ctx.fillRect(char.x - 6, baseY - 30, 2, 3);
  ctx.fillRect(char.x + 4, baseY - 30, 2, 3);

  // Eyes
  ctx.fillStyle = '#1a202c';
  const blinkFrame = Math.floor(time / 2000) % 10;
  if (blinkFrame !== 0) {
    ctx.fillRect(char.x - 3, baseY - 27, 2, 2);
    ctx.fillRect(char.x + 1, baseY - 27, 2, 2);
  } else {
    // Blink
    ctx.fillRect(char.x - 3, baseY - 26, 2, 1);
    ctx.fillRect(char.x + 1, baseY - 26, 2, 1);
  }

  // Mouth based on mode
  ctx.fillStyle = '#c53030';
  if (char.mode === 'celebrate') {
    // Big smile
    ctx.fillRect(char.x - 2, baseY - 23, 4, 1);
    ctx.fillRect(char.x - 1, baseY - 22, 2, 1);
  } else if (char.mode === 'error') {
    // Frown
    ctx.fillRect(char.x - 1, baseY - 22, 2, 1);
    ctx.fillRect(char.x - 2, baseY - 23, 1, 1);
    ctx.fillRect(char.x + 1, baseY - 23, 1, 1);
  } else if (char.mode === 'thinking') {
    // Hmm
    ctx.fillRect(char.x, baseY - 23, 2, 1);
  } else {
    // Neutral
    ctx.fillRect(char.x - 1, baseY - 23, 2, 1);
  }

  // Mode-specific effects
  if (char.mode === 'typing') {
    // Typing indicators
    const dotFrame = Math.floor(time / 150) % 3;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === dotFrame ? '#00ff88' : 'rgba(0, 255, 136, 0.3)';
      ctx.fillRect(char.x + 12 + i * 4, baseY - 25, 2, 2);
    }
  } else if (char.mode === 'thinking') {
    // Thought bubble
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(char.x + 18, baseY - 40, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(char.x + 10, baseY - 32, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(char.x + 6, baseY - 28, 2, 0, Math.PI * 2);
    ctx.fill();

    // Thinking content (rotating symbols)
    const thinkFrame = Math.floor(time / 500) % 3;
    ctx.fillStyle = '#805ad5';
    ctx.font = 'bold 8px monospace';
    const symbols = ['?', '...', '!'];
    ctx.fillText(symbols[thinkFrame], char.x + 14, baseY - 38);
  } else if (char.mode === 'celebrate') {
    // Confetti / sparkles
    const colors = ['#f6e05e', '#48bb78', '#ed8936', '#00d9ff', '#f56565'];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8 + (time / 500);
      const distance = 15 + Math.sin(time / 200 + i) * 8;
      const sx = char.x + Math.cos(angle) * distance;
      const sy = baseY - 20 + Math.sin(angle) * distance;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
    }

    // Stars above head
    ctx.fillStyle = '#f6e05e';
    const starY = baseY - 40 - Math.sin(time / 200) * 3;
    drawStar(ctx, char.x - 8, starY, 4);
    drawStar(ctx, char.x, starY - 5, 5);
    drawStar(ctx, char.x + 8, starY, 4);
  } else if (char.mode === 'running') {
    // Speed lines
    ctx.strokeStyle = 'rgba(237, 137, 54, 0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const lineY = baseY - 25 + i * 6;
      ctx.beginPath();
      ctx.moveTo(char.x - 15 - i * 2, lineY);
      ctx.lineTo(char.x - 8, lineY);
      ctx.stroke();
    }
  } else if (char.mode === 'error') {
    // Error indicators
    ctx.fillStyle = '#f56565';
    const errY = baseY - 45;

    // Exclamation mark
    ctx.fillRect(char.x - 1, errY, 3, 8);
    ctx.fillRect(char.x - 1, errY + 10, 3, 3);

    // Sweat drop
    ctx.fillStyle = '#90cdf4';
    ctx.beginPath();
    ctx.moveTo(char.x + 8, baseY - 28);
    ctx.lineTo(char.x + 10, baseY - 24);
    ctx.lineTo(char.x + 6, baseY - 24);
    ctx.closePath();
    ctx.fill();
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillRect(x - size / 2, y - 1, size, 2);
  ctx.fillRect(x - 1, y - size / 2, 2, size);
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + percent);
  const b = Math.min(255, (num & 0x0000ff) + percent);
  return `rgb(${r}, ${g}, ${b})`;
}
