import { ART_CONFIG } from '../types';

export interface CanvasContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
  dpr: number;
}

// Track current DPR for resize handling
let currentDpr = 1;

export function setupCanvas(canvasId: string): CanvasContext {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) {
    throw new Error(`Canvas element #${canvasId} not found`);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context');
  }

  // Get device pixel ratio for retina displays
  const dpr = window.devicePixelRatio || 1;
  currentDpr = dpr;

  // Scale canvas for DPR (actual pixel dimensions)
  canvas.width = ART_CONFIG.internalWidth * dpr;
  canvas.height = ART_CONFIG.internalHeight * dpr;

  // Scale context to draw at internal resolution
  ctx.scale(dpr, dpr);

  // Disable image smoothing for crisp pixels (must be after scale)
  ctx.imageSmoothingEnabled = false;

  // Calculate initial display scale
  const scale = calculateScale();
  applyScale(canvas, scale);

  // Handle resize and DPR changes
  window.addEventListener('resize', () => {
    const newDpr = window.devicePixelRatio || 1;
    const newScale = calculateScale();

    // If DPR changed, update canvas dimensions
    if (newDpr !== currentDpr) {
      currentDpr = newDpr;
      canvas.width = ART_CONFIG.internalWidth * newDpr;
      canvas.height = ART_CONFIG.internalHeight * newDpr;
      ctx.scale(newDpr, newDpr);
      ctx.imageSmoothingEnabled = false;
    }

    applyScale(canvas, newScale);
  });

  return { canvas, ctx, scale, dpr };
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
