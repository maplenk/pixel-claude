import { ART_CONFIG } from '../types';

export interface CanvasContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
}

// Track current integer scale for resize handling
let currentScale = 1;

// Double-buffering: offscreen canvas to prevent flickering
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;
let displayCanvas: HTMLCanvasElement | null = null;
let displayCtx: CanvasRenderingContext2D | null = null;

export function setupCanvas(canvasId: string): CanvasContext {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) {
    throw new Error(`Canvas element #${canvasId} not found`);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context');
  }

  // Set up display canvas (visible)
  displayCanvas = canvas;
  displayCtx = ctx;

  // Create offscreen canvas for double-buffering (prevents flickering)
  offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = ART_CONFIG.internalWidth;
  offscreenCanvas.height = ART_CONFIG.internalHeight;
  offscreenCtx = offscreenCanvas.getContext('2d');
  if (offscreenCtx) {
    offscreenCtx.imageSmoothingEnabled = false;
  }

  // Disable image smoothing on display canvas
  ctx.imageSmoothingEnabled = false;

  // Calculate initial display scale (integer for pixel-perfect rendering)
  const scale = calculateScale();
  currentScale = scale;
  applyScale(canvas, ctx, scale);

  // Handle resize changes
  window.addEventListener('resize', () => {
    const newScale = calculateScale();

    if (newScale !== currentScale) {
      currentScale = newScale;
      applyScale(canvas, ctx, newScale);
    }
  });

  // Return the offscreen context for drawing (prevents flickering)
  return { canvas, ctx: offscreenCtx!, scale };
}

function calculateScale(): number {
  const { internalWidth, internalHeight } = ART_CONFIG;

  // Calculate integer scale that fits the screen
  const scaleX = Math.floor(window.innerWidth / internalWidth);
  const scaleY = Math.floor(window.innerHeight / internalHeight);

  // Use the smaller scale to ensure it fits, minimum 1
  return Math.max(1, Math.min(scaleX, scaleY));
}

function applyScale(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, scale: number): void {
  const { internalWidth, internalHeight } = ART_CONFIG;
  const width = internalWidth * scale;
  const height = internalHeight * scale;

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Resizing resets smoothing settings
  ctx.imageSmoothingEnabled = false;
}

export function clearCanvas(ctx: CanvasRenderingContext2D, color = '#1a1a2e'): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ART_CONFIG.internalWidth, ART_CONFIG.internalHeight);
}

/**
 * Copy offscreen buffer to display canvas (call at end of each frame)
 * This is what eliminates flickering - we only show complete frames
 */
export function presentFrame(): void {
  if (!displayCtx || !offscreenCanvas || !displayCanvas) return;

  // Clear and copy the completed frame to display
  displayCtx.imageSmoothingEnabled = false;
  displayCtx.drawImage(
    offscreenCanvas,
    0, 0, ART_CONFIG.internalWidth, ART_CONFIG.internalHeight,
    0, 0, displayCanvas.width, displayCanvas.height
  );
}
