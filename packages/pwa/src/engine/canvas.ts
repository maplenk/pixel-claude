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

  // Calculate integer scale that fits the screen
  const scaleX = Math.floor(window.innerWidth / internalWidth);
  const scaleY = Math.floor(window.innerHeight / internalHeight);

  // Use the smaller scale to ensure it fits, minimum 1
  return Math.max(1, Math.min(scaleX, scaleY));
}

function applyScale(canvas: HTMLCanvasElement, scale: number): void {
  const { internalWidth, internalHeight } = ART_CONFIG;

  canvas.style.width = `${internalWidth * scale}px`;
  canvas.style.height = `${internalHeight * scale}px`;
}

export function clearCanvas(ctx: CanvasRenderingContext2D, color = '#1a1a2e'): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ART_CONFIG.internalWidth, ART_CONFIG.internalHeight);
}
