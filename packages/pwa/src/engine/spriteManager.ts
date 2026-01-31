/**
 * Sprite Manager - handles loading sprites with graceful fallback
 */

import {
  SpriteSheet,
  FrameData,
  loadSpriteSheet,
  createGridFrames,
  drawSpriteFrame,
} from './sprites';

// Sprite loading state
interface SpriteAsset {
  sheet: SpriteSheet | null;
  loading: boolean;
  error: string | null;
}

// Global sprite registry
const sprites: Map<string, SpriteAsset> = new Map();

// Whether sprites are available
let spritesEnabled = false;

/**
 * Initialize sprite loading - call once at startup
 */
export async function initSprites(): Promise<void> {
  // Load downloaded OpenGameArt sprites
  const assetList = [
    { name: 'characters', url: '/sprites/tiny16-characters.png', frames: createTiny16CharacterFrames() },
    { name: 'things', url: '/sprites/tiny16-things.png', frames: createTiny16ThingsFrames() },
    { name: 'office', url: '/sprites/office-tileset.png', frames: createOfficeFrames() },
    { name: 'laboffice', url: '/sprites/lab-office-tiles.png', frames: createLabOfficeFrames() },
  ];

  // Try to load each sprite sheet
  for (const asset of assetList) {
    sprites.set(asset.name, { sheet: null, loading: true, error: null });

    try {
      const sheet = await loadSpriteSheet(asset.url, asset.frames);
      sprites.set(asset.name, { sheet, loading: false, error: null });
      console.log(`[Sprites] Loaded: ${asset.name}`);
    } catch (err) {
      sprites.set(asset.name, {
        sheet: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load',
      });
      console.log(`[Sprites] Not found: ${asset.name} (using procedural fallback)`);
    }
  }

  // Check if any sprites loaded successfully
  spritesEnabled = Array.from(sprites.values()).some((s) => s.sheet !== null);

  if (spritesEnabled) {
    console.log('[Sprites] Sprite mode enabled');
  } else {
    console.log('[Sprites] No sprites found, using procedural rendering');
  }
}

/**
 * Check if sprites are available
 */
export function hasSprites(): boolean {
  return spritesEnabled;
}

/**
 * Get a specific sprite sheet
 */
export function getSprite(name: string): SpriteSheet | null {
  return sprites.get(name)?.sheet ?? null;
}

/**
 * Draw sprite with procedural fallback
 */
export function drawWithFallback(
  ctx: CanvasRenderingContext2D,
  spriteName: string,
  frameName: string,
  x: number,
  y: number,
  fallbackDraw: () => void
): void {
  const sprite = getSprite(spriteName);

  if (sprite && sprite.frames.has(frameName)) {
    drawSpriteFrame(ctx, sprite, frameName, x, y);
  } else {
    fallbackDraw();
  }
}

// =============================================================================
// FRAME DEFINITIONS FOR DOWNLOADED SPRITES
// =============================================================================

/**
 * Tiny 16 Characters (192x128 = 12x8 grid of 16x16)
 * From: https://opengameart.org/content/tiny-16-basic
 */
function createTiny16CharacterFrames(): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 16;

  // Row 0-1: Human characters (various poses)
  // Using first row for different character states
  for (let i = 0; i < 12; i++) {
    frames.push({ name: `char_${i}`, x: i * w, y: 0, w, h });
  }

  // Row 2-3: More characters
  for (let i = 0; i < 12; i++) {
    frames.push({ name: `char_${12 + i}`, x: i * w, y: h * 2, w, h });
  }

  // Map to mode-based names for easier use
  // Use first few sprites for different modes
  frames.push({ name: 'idle_0', x: 0, y: 0, w, h });
  frames.push({ name: 'idle_1', x: w, y: 0, w, h });
  frames.push({ name: 'walk_0', x: w * 2, y: 0, w, h });
  frames.push({ name: 'walk_1', x: w * 3, y: 0, w, h });
  frames.push({ name: 'type_0', x: w * 4, y: 0, w, h });
  frames.push({ name: 'type_1', x: w * 5, y: 0, w, h });
  frames.push({ name: 'think_0', x: w * 6, y: 0, w, h });
  frames.push({ name: 'think_1', x: w * 7, y: 0, w, h });

  return frames;
}

/**
 * Tiny 16 Things (192x128 = 12x8 grid of 16x16)
 * Objects and items
 */
function createTiny16ThingsFrames(): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 16;

  // Grid-based frames
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 12; col++) {
      frames.push({ name: `thing_${row}_${col}`, x: col * w, y: row * h, w, h });
    }
  }

  // Named items (based on typical sprite sheet layout)
  frames.push({ name: 'chest', x: 0, y: 0, w, h });
  frames.push({ name: 'potion', x: w, y: 0, w, h });
  frames.push({ name: 'book', x: w * 2, y: 0, w, h });
  frames.push({ name: 'scroll', x: w * 3, y: 0, w, h });

  return frames;
}

/**
 * Office Space Tileset (480x192 = 10x4 grid of 48x48)
 * From: https://opengameart.org/content/office-space-tileset
 * Note: This is 16x48 layered tiles for side-scroller
 */
function createOfficeFrames(): FrameData[] {
  const frames: FrameData[] = [];

  // Office tileset is 480x192, appears to be 16x48 tiles (30x4 grid)
  const w = 16;
  const h = 48;

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 30; col++) {
      frames.push({ name: `office_${row}_${col}`, x: col * w, y: row * h, w, h });
    }
  }

  // Named office items
  frames.push({ name: 'desk_side', x: 0, y: 0, w: 48, h: 48 });
  frames.push({ name: 'computer', x: 48, y: 0, w: 32, h: 48 });
  frames.push({ name: 'chair_side', x: 80, y: 0, w: 16, h: 48 });
  frames.push({ name: 'plant_tall', x: 96, y: 0, w: 16, h: 48 });
  frames.push({ name: 'bookshelf', x: 112, y: 0, w: 32, h: 48 });
  frames.push({ name: 'window', x: 144, y: 0, w: 32, h: 48 });

  return frames;
}

/**
 * Lab/Office Tiles (256x256 = 8x8 grid of 32x32)
 * From: https://opengameart.org/content/pixel-art-laboffice-tiles
 */
function createLabOfficeFrames(): FrameData[] {
  const frames: FrameData[] = [];
  const w = 32;
  const h = 32;

  // 8x8 grid of 32x32 tiles
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      frames.push({ name: `lab_${row}_${col}`, x: col * w, y: row * h, w, h });
    }
  }

  // Named items (based on expected lab/office contents)
  frames.push({ name: 'computer_top', x: 0, y: 0, w, h });
  frames.push({ name: 'desk_top', x: w, y: 0, w, h });
  frames.push({ name: 'chair_top', x: w * 2, y: 0, w, h });
  frames.push({ name: 'server_rack', x: w * 3, y: 0, w, h });
  frames.push({ name: 'whiteboard_tile', x: w * 4, y: 0, w, h });
  frames.push({ name: 'floor_tile', x: 0, y: h, w, h });
  frames.push({ name: 'wall_tile', x: w, y: h, w, h });

  return frames;
}

/**
 * Get animation frame name for a mode
 */
export function getModeFrame(mode: string, time: number): string {
  const frameIndex = Math.floor(time / 200) % 4;

  switch (mode) {
    case 'typing':
      return `type_${frameIndex}`;
    case 'thinking':
      return `think_${frameIndex}`;
    case 'running':
      return `walk_${frameIndex}`;
    case 'celebrate':
      return `celebrate_${frameIndex}`;
    case 'error':
      return `error_${frameIndex}`;
    default:
      return `idle_${frameIndex}`;
  }
}
