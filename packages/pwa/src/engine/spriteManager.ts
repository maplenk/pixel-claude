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
  // Load LimeZu Modern Interiors sprites (high quality)
  const limeZuAssets = [
    { name: 'limezu-adam-idle', url: '/sprites/limezu/Adam_idle_anim_16x16.png', frames: createLimeZuCharacterFrames('adam_idle') },
    { name: 'limezu-adam-sit', url: '/sprites/limezu/Adam_sit_16x16.png', frames: createLimeZuCharacterFrames('adam_sit') },
    { name: 'limezu-adam-run', url: '/sprites/limezu/Adam_run_16x16.png', frames: createLimeZuCharacterFrames('adam_run') },
    { name: 'limezu-adam-phone', url: '/sprites/limezu/Adam_phone_16x16.png', frames: createLimeZuPhoneFrames('adam_phone') },
    { name: 'limezu-alex-idle', url: '/sprites/limezu/Alex_idle_anim_16x16.png', frames: createLimeZuCharacterFrames('alex_idle') },
    { name: 'limezu-alex-sit', url: '/sprites/limezu/Alex_sit_16x16.png', frames: createLimeZuCharacterFrames('alex_sit') },
    { name: 'limezu-interiors', url: '/sprites/limezu/Interiors_free_16x16.png', frames: createLimeZuInteriorsFrames() },
    { name: 'limezu-room', url: '/sprites/limezu/Room_Builder_free_16x16.png', frames: createLimeZuRoomFrames() },
  ];

  // Load OpenGameArt sprites as fallback
  const openGameArtAssets = [
    { name: 'characters', url: '/sprites/tiny16-characters.png', frames: createTiny16CharacterFrames() },
    { name: 'things', url: '/sprites/tiny16-things.png', frames: createTiny16ThingsFrames() },
    { name: 'office', url: '/sprites/office-tileset.png', frames: createOfficeFrames() },
    { name: 'laboffice', url: '/sprites/lab-office-tiles.png', frames: createLabOfficeFrames() },
  ];

  const assetList = [...limeZuAssets, ...openGameArtAssets];

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
// LIMEZU MODERN INTERIORS FRAME DEFINITIONS
// =============================================================================

/**
 * LimeZu Character Frames (384x32 = 24 frames of 16x32)
 * 4 directions x 6 frames each: down, left, right, up
 */
function createLimeZuCharacterFrames(prefix: string): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 32;

  // 24 frames total: 6 per direction (down, left, right, up)
  const directions = ['down', 'left', 'right', 'up'];
  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 6; frame++) {
      frames.push({
        name: `${prefix}_${directions[dir]}_${frame}`,
        x: (dir * 6 + frame) * w,
        y: 0,
        w,
        h,
      });
    }
  }

  // Convenience aliases for simple animation
  frames.push({ name: `${prefix}_0`, x: 0, y: 0, w, h });
  frames.push({ name: `${prefix}_1`, x: w, y: 0, w, h });
  frames.push({ name: `${prefix}_2`, x: w * 2, y: 0, w, h });
  frames.push({ name: `${prefix}_3`, x: w * 3, y: 0, w, h });

  return frames;
}

/**
 * LimeZu Phone Frames (144x32 = 9 frames of 16x32)
 */
function createLimeZuPhoneFrames(prefix: string): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 32;

  for (let i = 0; i < 9; i++) {
    frames.push({ name: `${prefix}_${i}`, x: i * w, y: 0, w, h });
  }

  return frames;
}

/**
 * LimeZu Interiors (256x1424 = 16 cols x 89 rows of 16x16)
 */
function createLimeZuInteriorsFrames(): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 16;
  const cols = 16;
  const rows = 89;

  // Grid-based frames
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      frames.push({ name: `interior_${row}_${col}`, x: col * w, y: row * h, w, h });
    }
  }

  // Named furniture items (approximate positions based on typical LimeZu layout)
  // Desks usually around rows 10-15
  frames.push({ name: 'desk_top', x: 0, y: 160, w: 32, h: 32 });
  frames.push({ name: 'computer_monitor', x: 32, y: 160, w: 16, h: 16 });
  frames.push({ name: 'keyboard', x: 48, y: 176, w: 16, h: 16 });
  frames.push({ name: 'chair', x: 64, y: 160, w: 16, h: 32 });
  frames.push({ name: 'bookshelf', x: 0, y: 192, w: 32, h: 48 });
  frames.push({ name: 'plant', x: 96, y: 160, w: 16, h: 32 });
  frames.push({ name: 'lamp', x: 112, y: 160, w: 16, h: 32 });
  frames.push({ name: 'whiteboard', x: 128, y: 0, w: 48, h: 32 });
  frames.push({ name: 'corkboard', x: 176, y: 0, w: 32, h: 32 });

  return frames;
}

/**
 * LimeZu Room Builder (272x368 = 17 cols x 23 rows of 16x16)
 */
function createLimeZuRoomFrames(): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 16;
  const cols = 17;
  const rows = 23;

  // Grid-based frames
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      frames.push({ name: `room_${row}_${col}`, x: col * w, y: row * h, w, h });
    }
  }

  // Floor and wall tiles
  frames.push({ name: 'floor_wood', x: 0, y: 0, w, h });
  frames.push({ name: 'floor_tile', x: 16, y: 0, w, h });
  frames.push({ name: 'wall_top', x: 0, y: 16, w, h });
  frames.push({ name: 'wall_bottom', x: 0, y: 32, w, h });

  return frames;
}

// =============================================================================
// OPENGAMEART FRAME DEFINITIONS (FALLBACK)
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

/**
 * Get LimeZu character animation frame
 */
export function getLimeZuFrame(animation: string, time: number, direction = 'down'): string {
  const frameIndex = Math.floor(time / 150) % 6;
  return `${animation}_${direction}_${frameIndex}`;
}

/**
 * Check if LimeZu sprites are loaded
 */
export function hasLimeZuSprites(): boolean {
  return getSprite('limezu-adam-idle') !== null;
}
