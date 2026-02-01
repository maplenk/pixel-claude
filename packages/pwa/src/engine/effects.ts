/**
 * Tool Effect Particle System
 * Visual effects for different tool and skill actions
 */

import type { ToolEffectType } from '../types';

// Effect colors
const COLORS = {
  skill: { primary: '#FFD700', secondary: '#9B59B6' },      // Gold + Purple
  file_read: { primary: '#4A9EFF', secondary: '#2980B9' },  // Blue
  file_write: { primary: '#00FF88', secondary: '#27AE60' }, // Green
  terminal: { primary: '#FFAA00', secondary: '#E67E22' },   // Orange
  browser: { primary: '#00D9FF', secondary: '#3498DB' },    // Cyan
  agent: { primary: '#9E4AFF', secondary: '#8E44AD' },      // Purple
  default: { primary: '#888888', secondary: '#666666' },    // Gray
};

// Active effects list
interface ActiveEffect {
  type: ToolEffectType;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  toolUseId: string;
}

const activeEffects: ActiveEffect[] = [];

/**
 * Start a new tool effect
 */
export function startToolEffect(
  type: ToolEffectType,
  x: number,
  y: number,
  toolUseId: string
): void {
  // Remove any existing effect with same toolUseId
  const idx = activeEffects.findIndex(e => e.toolUseId === toolUseId);
  if (idx !== -1) {
    activeEffects.splice(idx, 1);
  }

  activeEffects.push({
    type,
    x,
    y,
    startTime: Date.now(),
    duration: type === 'skill' ? 1500 : 1000, // Skills last longer
    toolUseId,
  });
}

/**
 * Stop a tool effect (on completion)
 */
export function stopToolEffect(toolUseId: string): void {
  const idx = activeEffects.findIndex(e => e.toolUseId === toolUseId);
  if (idx !== -1) {
    // Let it fade out naturally by reducing duration
    activeEffects[idx].duration = Math.min(
      activeEffects[idx].duration,
      Date.now() - activeEffects[idx].startTime + 300
    );
  }
}

/**
 * Draw all active effects
 */
export function drawToolEffects(
  ctx: CanvasRenderingContext2D,
  time: number
): void {
  const now = Date.now();

  // Draw and clean up expired effects
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const effect = activeEffects[i];
    const elapsed = now - effect.startTime;

    if (elapsed >= effect.duration) {
      activeEffects.splice(i, 1);
      continue;
    }

    const progress = elapsed / effect.duration;
    drawEffect(ctx, effect, progress, time);
  }
}

/**
 * Draw a single effect based on type
 */
function drawEffect(
  ctx: CanvasRenderingContext2D,
  effect: ActiveEffect,
  progress: number,
  time: number
): void {
  const { x, y, type } = effect;
  const colors = COLORS[type];
  const alpha = 1 - progress; // Fade out

  ctx.save();

  switch (type) {
    case 'skill':
      drawSkillEffect(ctx, x, y, progress, time, colors, alpha);
      break;
    case 'file_read':
      drawFileReadEffect(ctx, x, y, progress, time, colors, alpha);
      break;
    case 'file_write':
      drawFileWriteEffect(ctx, x, y, progress, time, colors, alpha);
      break;
    case 'terminal':
      drawTerminalEffect(ctx, x, y, progress, time, colors, alpha);
      break;
    case 'browser':
      drawBrowserEffect(ctx, x, y, progress, time, colors, alpha);
      break;
    case 'agent':
      drawAgentPortalEffect(ctx, x, y, progress, time, colors, alpha);
      break;
    default:
      drawDefaultEffect(ctx, x, y, progress, time, colors, alpha);
  }

  ctx.restore();
}

/**
 * Skill Effect: Gold sparkle burst with purple aura
 */
function drawSkillEffect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  progress: number,
  time: number,
  colors: { primary: string; secondary: string },
  alpha: number
): void {
  // Pulsing aura
  const auraRadius = 12 + Math.sin(time / 100) * 3;
  const gradient = ctx.createRadialGradient(x, y - 20, 0, x, y - 20, auraRadius);
  gradient.addColorStop(0, `rgba(155, 89, 182, ${alpha * 0.4})`);
  gradient.addColorStop(1, 'rgba(155, 89, 182, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y - 20, auraRadius, 0, Math.PI * 2);
  ctx.fill();

  // Sparkle particles
  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2 + time / 200;
    const dist = 8 + progress * 12;
    const px = x + Math.cos(angle) * dist;
    const py = y - 20 + Math.sin(angle) * dist;
    const size = 2 * (1 - progress * 0.5);

    ctx.fillStyle = i % 2 === 0 ? colors.primary : colors.secondary;
    ctx.globalAlpha = alpha;
    drawStar(ctx, px, py, size);
  }

  // Central sparkle
  ctx.fillStyle = colors.primary;
  ctx.globalAlpha = alpha * (0.5 + Math.sin(time / 80) * 0.5);
  drawStar(ctx, x, y - 20, 3);
}

/**
 * File Read Effect: Blue document with scan line
 */
function drawFileReadEffect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  progress: number,
  time: number,
  colors: { primary: string; secondary: string },
  alpha: number
): void {
  const docY = y - 25 - progress * 5;

  // Document icon
  ctx.fillStyle = colors.primary;
  ctx.globalAlpha = alpha * 0.8;
  ctx.fillRect(x - 4, docY, 8, 10);

  // Document fold
  ctx.fillStyle = colors.secondary;
  ctx.beginPath();
  ctx.moveTo(x + 2, docY);
  ctx.lineTo(x + 4, docY);
  ctx.lineTo(x + 4, docY + 2);
  ctx.closePath();
  ctx.fill();

  // Scan line
  const scanY = docY + (time / 50) % 10;
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = alpha * 0.6;
  ctx.fillRect(x - 3, scanY, 6, 1);

  // Rising particles
  for (let i = 0; i < 3; i++) {
    const px = x - 6 + i * 6;
    const py = docY + 12 - ((time / 80 + i * 30) % 15);
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillRect(px, py, 1, 2);
  }
}

/**
 * File Write Effect: Green pencil with sparks
 */
function drawFileWriteEffect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  progress: number,
  time: number,
  colors: { primary: string; secondary: string },
  alpha: number
): void {
  const pencilX = x + Math.sin(time / 100) * 2;
  const pencilY = y - 22;

  // Pencil body
  ctx.fillStyle = colors.secondary;
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(pencilX, pencilY);
  ctx.rotate(-0.3);
  ctx.fillRect(-1, -6, 3, 8);
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.moveTo(-1, 2);
  ctx.lineTo(0.5, 5);
  ctx.lineTo(2, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Writing sparks
  const sparkCount = 4;
  for (let i = 0; i < sparkCount; i++) {
    const angle = (time / 100 + i * 1.5) % (Math.PI * 2);
    const dist = 4 + Math.random() * 3;
    const sx = pencilX + Math.cos(angle) * dist;
    const sy = pencilY + 5 + Math.sin(angle) * 2;

    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = alpha * (0.3 + Math.random() * 0.4);
    ctx.fillRect(sx, sy, 1, 1);
  }
}

/**
 * Terminal Effect: Orange command prompt pulse
 */
function drawTerminalEffect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  progress: number,
  time: number,
  colors: { primary: string; secondary: string },
  alpha: number
): void {
  const termY = y - 28;
  const pulse = 0.8 + Math.sin(time / 100) * 0.2;

  // Terminal box
  ctx.fillStyle = '#1a1a1a';
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillRect(x - 8, termY, 16, 10);

  // Border pulse
  ctx.strokeStyle = colors.primary;
  ctx.globalAlpha = alpha * pulse;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 8, termY, 16, 10);

  // Command prompt
  ctx.fillStyle = colors.primary;
  ctx.globalAlpha = alpha;
  ctx.fillRect(x - 6, termY + 2, 2, 1);
  ctx.fillRect(x - 6, termY + 4, 4 + (time / 50) % 6, 1);
  ctx.fillRect(x - 6, termY + 6, 3, 1);

  // Cursor blink
  if (Math.floor(time / 300) % 2 === 0) {
    ctx.fillRect(x - 2 + (time / 50) % 6, termY + 4, 1, 1);
  }
}

/**
 * Browser Effect: Cyan globe with network lines
 */
function drawBrowserEffect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  progress: number,
  time: number,
  colors: { primary: string; secondary: string },
  alpha: number
): void {
  const globeY = y - 24;
  const rotation = time / 500;

  // Globe outline
  ctx.strokeStyle = colors.primary;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, globeY, 6, 0, Math.PI * 2);
  ctx.stroke();

  // Latitude line
  ctx.beginPath();
  ctx.ellipse(x, globeY, 6, 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Longitude line (rotating)
  ctx.beginPath();
  ctx.ellipse(x, globeY, 2 + Math.sin(rotation) * 4, 6, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Network dots
  for (let i = 0; i < 4; i++) {
    const angle = rotation + (i * Math.PI / 2);
    const dist = 10 + Math.sin(time / 150 + i) * 2;
    const nx = x + Math.cos(angle) * dist;
    const ny = globeY + Math.sin(angle) * 4;

    ctx.fillStyle = colors.secondary;
    ctx.globalAlpha = alpha * 0.6;
    ctx.beginPath();
    ctx.arc(nx, ny, 1, 0, Math.PI * 2);
    ctx.fill();

    // Connection line
    ctx.strokeStyle = colors.primary;
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * 6, globeY + Math.sin(angle) * 2);
    ctx.lineTo(nx, ny);
    ctx.stroke();
  }
}

/**
 * Agent Portal Effect: Purple spiral opening
 */
function drawAgentPortalEffect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  progress: number,
  time: number,
  colors: { primary: string; secondary: string },
  alpha: number
): void {
  const portalY = y - 20;
  const radius = 8 + progress * 4;
  const spiralAngle = time / 150;

  // Portal glow
  const gradient = ctx.createRadialGradient(x, portalY, 0, x, portalY, radius);
  gradient.addColorStop(0, `rgba(158, 74, 255, ${alpha * 0.5})`);
  gradient.addColorStop(0.5, `rgba(142, 68, 173, ${alpha * 0.3})`);
  gradient.addColorStop(1, 'rgba(142, 68, 173, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, portalY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Spiral arms
  ctx.strokeStyle = colors.primary;
  ctx.globalAlpha = alpha * 0.8;
  ctx.lineWidth = 1;

  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    const startAngle = spiralAngle + (arm * Math.PI * 2 / 3);
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      const angle = startAngle + t * Math.PI * 1.5;
      const r = t * radius * 0.8;
      const px = x + Math.cos(angle) * r;
      const py = portalY + Math.sin(angle) * r * 0.6; // Oval shape
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Center spark
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = alpha * (0.5 + Math.sin(time / 80) * 0.5);
  ctx.beginPath();
  ctx.arc(x, portalY, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Default Effect: Spinning gear
 */
function drawDefaultEffect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  progress: number,
  time: number,
  colors: { primary: string; secondary: string },
  alpha: number
): void {
  const gearY = y - 22;
  const rotation = time / 300;

  ctx.save();
  ctx.translate(x, gearY);
  ctx.rotate(rotation);

  // Gear teeth
  ctx.fillStyle = colors.primary;
  ctx.globalAlpha = alpha;
  const teeth = 6;
  const innerR = 3;
  const outerR = 5;

  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2;
    ctx.save();
    ctx.rotate(angle);
    ctx.fillRect(-1, innerR, 2, outerR - innerR);
    ctx.restore();
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(0, 0, innerR, 0, Math.PI * 2);
  ctx.fill();

  // Inner hole
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Helper: Draw a simple star shape
 */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillRect(x - size / 2, y - 0.5, size, 1);
  ctx.fillRect(x - 0.5, y - size / 2, 1, size);
  // Diagonal points
  ctx.fillRect(x - size / 3, y - size / 3, size / 3, size / 3);
  ctx.fillRect(x, y, size / 3, size / 3);
}

/**
 * Check if there are any active effects
 */
export function hasActiveEffects(): boolean {
  return activeEffects.length > 0;
}
