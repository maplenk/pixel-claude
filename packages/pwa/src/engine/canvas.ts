import { ART_CONFIG } from '../types';

export interface CanvasContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
}

export function setupCanvas(canvasId: string): CanvasContext {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) {
    throw new Error(`Canvas element #${canvasId} not found`);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context');
  }

  // Set internal resolution
  canvas.width = ART_CONFIG.internalWidth;
  canvas.height = ART_CONFIG.internalHeight;

  // Disable image smoothing for crisp pixels
  ctx.imageSmoothingEnabled = false;

  // Calculate initial scale
  const scale = calculateScale();
  applyScale(canvas, scale);

  // Handle resize
  window.addEventListener('resize', () => {
    const newScale = calculateScale();
    applyScale(canvas, newScale);
  });

  return { canvas, ctx, scale };
}

function calculateScale(): number {
  const { internalWidth, internalHeight } = ART_CONFIG;

  // Calculate scale to cover the screen
  const scaleX = window.innerWidth / internalWidth;
  const scaleY = window.innerHeight / internalHeight;

  // Use larger scale to fill screen
  return Math.max(scaleX, scaleY);
}

function applyScale(canvas: HTMLCanvasElement, _scale: number): void {
  // Fill the viewport
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

export function clearCanvas(ctx: CanvasRenderingContext2D, color = '#1a1a2e'): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ART_CONFIG.internalWidth, ART_CONFIG.internalHeight);
}
