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
    { name: 'limezu-alex-run', url: '/sprites/limezu/Alex_run_16x16.png', frames: createLimeZuCharacterFrames('alex_run') },
    { name: 'limezu-interiors', url: '/sprites/limezu/Interiors_free_16x16.png', frames: createLimeZuInteriorsFrames() },
    { name: 'limezu-room', url: '/sprites/limezu/Room_Builder_free_16x16.png', frames: createLimeZuRoomFrames() },
    // Modern Office pack (paid)
    { name: 'limezu-office', url: '/sprites/limezu/office/Modern_Office_16x16.png', frames: createModernOfficeFrames() },
    { name: 'limezu-office-room', url: '/sprites/limezu/office/Room_Builder_Office_16x16.png', frames: createOfficeRoomFrames() },
    // Premade characters for sub-agents (paid)
    { name: 'limezu-char-01', url: '/sprites/limezu/Premade_Character_01.png', frames: createPremadeCharacterFrames('char01') },
    { name: 'limezu-char-02', url: '/sprites/limezu/Premade_Character_02.png', frames: createPremadeCharacterFrames('char02') },
    { name: 'limezu-char-03', url: '/sprites/limezu/Premade_Character_03.png', frames: createPremadeCharacterFrames('char03') },
    { name: 'limezu-char-04', url: '/sprites/limezu/Premade_Character_04.png', frames: createPremadeCharacterFrames('char04') },
    { name: 'limezu-char-05', url: '/sprites/limezu/Premade_Character_05.png', frames: createPremadeCharacterFrames('char05') },
    { name: 'limezu-char-06', url: '/sprites/limezu/Premade_Character_06.png', frames: createPremadeCharacterFrames('char06') },
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
 * Carefully mapped from actual sprite sheet
 */
function createLimeZuInteriorsFrames(): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 16;
  const cols = 16;
  const rows = 89;

  // Grid-based frames for precise access
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      frames.push({ name: `interior_${row}_${col}`, x: col * w, y: row * h, w, h });
    }
  }

  // ==========================================================================
  // OFFICE FURNITURE (mapped from actual sprite positions)
  // ==========================================================================

  // Desks (row 4-5 area - brown wooden desks)
  frames.push({ name: 'desk_brown_top', x: 0, y: 64, w: 32, h: 16 });
  frames.push({ name: 'desk_brown_front', x: 0, y: 80, w: 32, h: 16 });
  frames.push({ name: 'desk_small', x: 64, y: 64, w: 16, h: 32 });

  // Office chairs (row 28+ area - grey swivel chairs)
  frames.push({ name: 'office_chair_back', x: 0, y: 448, w: 16, h: 16 });
  frames.push({ name: 'office_chair_front', x: 16, y: 448, w: 16, h: 16 });
  frames.push({ name: 'office_chair_side', x: 32, y: 448, w: 16, h: 16 });

  // Orange/wood chairs (row 12-13)
  frames.push({ name: 'chair_orange_back', x: 0, y: 192, w: 16, h: 16 });
  frames.push({ name: 'chair_orange_front', x: 16, y: 192, w: 16, h: 16 });
  frames.push({ name: 'chair_orange_side', x: 32, y: 192, w: 16, h: 16 });

  // Computers/Monitors (around row 22-23 area)
  frames.push({ name: 'computer_desk', x: 64, y: 352, w: 32, h: 32 });
  frames.push({ name: 'monitor_on', x: 80, y: 352, w: 16, h: 16 });
  frames.push({ name: 'monitor_off', x: 96, y: 352, w: 16, h: 16 });
  frames.push({ name: 'keyboard', x: 80, y: 368, w: 16, h: 16 });

  // Bookshelves (row 6 area - colorful)
  frames.push({ name: 'bookshelf_full', x: 0, y: 96, w: 32, h: 48 });
  frames.push({ name: 'bookshelf_small', x: 32, y: 96, w: 16, h: 32 });
  frames.push({ name: 'bookshelf_tall', x: 48, y: 96, w: 16, h: 48 });

  // Plants (row 17-20 area)
  frames.push({ name: 'plant_small', x: 0, y: 320, w: 16, h: 16 });
  frames.push({ name: 'plant_medium', x: 16, y: 304, w: 16, h: 32 });
  frames.push({ name: 'plant_large', x: 32, y: 288, w: 16, h: 48 });
  frames.push({ name: 'plant_pot', x: 48, y: 320, w: 16, h: 16 });
  frames.push({ name: 'palm_tree', x: 208, y: 272, w: 32, h: 48 });

  // Lamps (row 20-21 - mushroom lamps and desk lamps)
  frames.push({ name: 'lamp_desk', x: 128, y: 320, w: 16, h: 32 });
  frames.push({ name: 'lamp_mushroom_red', x: 160, y: 320, w: 16, h: 32 });
  frames.push({ name: 'lamp_mushroom_blue', x: 176, y: 320, w: 16, h: 32 });
  frames.push({ name: 'lamp_mushroom_green', x: 192, y: 320, w: 16, h: 32 });
  frames.push({ name: 'lamp_floor', x: 144, y: 320, w: 16, h: 32 });

  // Chalkboard/Whiteboard (row 14-15 - green boards)
  frames.push({ name: 'chalkboard', x: 64, y: 224, w: 48, h: 32 });
  frames.push({ name: 'chalkboard_small', x: 112, y: 224, w: 32, h: 32 });

  // Couches/Sofas (row 16-17 and 26-27)
  frames.push({ name: 'couch_blue', x: 0, y: 256, w: 48, h: 32 });
  frames.push({ name: 'couch_grey', x: 0, y: 416, w: 48, h: 32 });
  frames.push({ name: 'couch_beige', x: 48, y: 416, w: 48, h: 32 });

  // Rugs (row 6-7)
  frames.push({ name: 'rug_blue', x: 192, y: 96, w: 48, h: 32 });
  frames.push({ name: 'rug_red', x: 128, y: 112, w: 48, h: 32 });
  frames.push({ name: 'rug_brown', x: 176, y: 112, w: 32, h: 32 });

  // Windows (row 10-11)
  frames.push({ name: 'window_large', x: 0, y: 160, w: 32, h: 32 });
  frames.push({ name: 'window_small', x: 32, y: 160, w: 16, h: 32 });
  frames.push({ name: 'window_curtain', x: 64, y: 160, w: 32, h: 32 });

  // Wall decorations
  frames.push({ name: 'painting_landscape', x: 128, y: 144, w: 32, h: 16 });
  frames.push({ name: 'painting_portrait', x: 160, y: 144, w: 16, h: 32 });
  frames.push({ name: 'clock', x: 176, y: 144, w: 16, h: 16 });
  frames.push({ name: 'poster', x: 192, y: 144, w: 16, h: 32 });

  // Water cooler (custom assembly)
  frames.push({ name: 'water_cooler_top', x: 224, y: 352, w: 16, h: 16 });
  frames.push({ name: 'water_cooler_bottom', x: 224, y: 368, w: 16, h: 16 });

  // Server/Electronics
  frames.push({ name: 'server_rack', x: 208, y: 384, w: 32, h: 48 });
  frames.push({ name: 'vending_machine', x: 176, y: 384, w: 32, h: 48 });

  return frames;
}

/**
 * LimeZu Room Builder (272x368 = 17 cols x 23 rows of 16x16)
 * Floor tiles on right side, wall panels on left
 */
function createLimeZuRoomFrames(): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 16;
  const cols = 17;
  const rows = 23;

  // Grid-based frames for precise access
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      frames.push({ name: `room_${row}_${col}`, x: col * w, y: row * h, w, h });
    }
  }

  // ==========================================================================
  // FLOOR TILES (right side of sprite sheet)
  // ==========================================================================

  // Wood floors (various tones)
  frames.push({ name: 'floor_wood_light', x: 80, y: 64, w, h });
  frames.push({ name: 'floor_wood_medium', x: 96, y: 64, w, h });
  frames.push({ name: 'floor_wood_dark', x: 112, y: 64, w, h });
  frames.push({ name: 'floor_wood_herringbone', x: 144, y: 64, w, h });

  // Carpet/Tile floors
  frames.push({ name: 'floor_carpet_red', x: 80, y: 48, w, h });
  frames.push({ name: 'floor_carpet_blue', x: 96, y: 48, w, h });
  frames.push({ name: 'floor_tile_white', x: 128, y: 48, w, h });
  frames.push({ name: 'floor_tile_checker', x: 144, y: 48, w, h });
  frames.push({ name: 'floor_stone', x: 160, y: 48, w, h });

  // ==========================================================================
  // WALL TILES (left side - colored wall panels)
  // ==========================================================================

  // Wall panels with baseboards
  frames.push({ name: 'wall_blue_top', x: 0, y: 32, w, h });
  frames.push({ name: 'wall_blue_bottom', x: 0, y: 48, w, h });
  frames.push({ name: 'wall_yellow_top', x: 0, y: 64, w, h });
  frames.push({ name: 'wall_yellow_bottom', x: 0, y: 80, w, h });
  frames.push({ name: 'wall_wood_top', x: 0, y: 96, w, h });
  frames.push({ name: 'wall_wood_bottom', x: 0, y: 112, w, h });
  frames.push({ name: 'wall_white_top', x: 0, y: 128, w, h });
  frames.push({ name: 'wall_white_bottom', x: 0, y: 144, w, h });
  frames.push({ name: 'wall_grey_top', x: 0, y: 160, w, h });
  frames.push({ name: 'wall_grey_bottom', x: 0, y: 176, w, h });
  frames.push({ name: 'wall_pink_top', x: 0, y: 192, w, h });
  frames.push({ name: 'wall_pink_bottom', x: 0, y: 208, w, h });

  // Wall with windows
  frames.push({ name: 'wall_window_top', x: 16, y: 32, w: 32, h });
  frames.push({ name: 'wall_window_bottom', x: 16, y: 48, w: 32, h });

  // Baseboard/ceiling trim
  frames.push({ name: 'ceiling_trim', x: 48, y: 0, w, h });
  frames.push({ name: 'baseboard', x: 48, y: 16, w, h });

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

/**
 * Check if Modern Office sprites are loaded
 */
export function hasModernOfficeSprites(): boolean {
  return getSprite('limezu-office') !== null;
}

/**
 * Get a premade character sprite for sub-agents
 */
export function getPremadeCharacter(index: number): SpriteSheet | null {
  const charIndex = (index % 6) + 1;
  return getSprite(`limezu-char-0${charIndex}`);
}

// =============================================================================
// MODERN OFFICE FRAME DEFINITIONS (PAID PACK)
// =============================================================================

/**
 * Modern Office Tileset (256 x ~800 estimated)
 * Based on the tileset image layout
 */
function createModernOfficeFrames(): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 16;
  const cols = 16;
  const rows = 50; // Estimated rows based on file size

  // Grid-based frames for precise access
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      frames.push({ name: `office_${row}_${col}`, x: col * w, y: row * h, w, h });
    }
  }

  // ==========================================================================
  // CUBICLE DIVIDERS (top rows - grey dividers)
  // ==========================================================================
  frames.push({ name: 'cubicle_top_left', x: 0, y: 0, w, h });
  frames.push({ name: 'cubicle_top', x: 16, y: 0, w, h });
  frames.push({ name: 'cubicle_top_right', x: 32, y: 0, w, h });
  frames.push({ name: 'cubicle_left', x: 0, y: 16, w, h });
  frames.push({ name: 'cubicle_right', x: 32, y: 16, w, h });
  frames.push({ name: 'cubicle_bottom_left', x: 0, y: 32, w, h });
  frames.push({ name: 'cubicle_bottom', x: 16, y: 32, w, h });
  frames.push({ name: 'cubicle_bottom_right', x: 32, y: 32, w, h });

  // ==========================================================================
  // OFFICE CHAIRS (row 2-3 - various colors)
  // ==========================================================================
  frames.push({ name: 'chair_grey_back', x: 0, y: 48, w, h });
  frames.push({ name: 'chair_grey_front', x: 16, y: 48, w, h });
  frames.push({ name: 'chair_grey_left', x: 32, y: 48, w, h });
  frames.push({ name: 'chair_grey_right', x: 48, y: 48, w, h });
  frames.push({ name: 'chair_blue_back', x: 64, y: 48, w, h });
  frames.push({ name: 'chair_blue_front', x: 80, y: 48, w, h });
  frames.push({ name: 'chair_orange_back', x: 0, y: 64, w, h });
  frames.push({ name: 'chair_orange_front', x: 16, y: 64, w, h });

  // ==========================================================================
  // DESKS & TABLES (row 4-6)
  // ==========================================================================
  frames.push({ name: 'desk_wood_2x1_left', x: 0, y: 80, w, h });
  frames.push({ name: 'desk_wood_2x1_right', x: 16, y: 80, w, h });
  frames.push({ name: 'desk_wood_front_left', x: 0, y: 96, w, h });
  frames.push({ name: 'desk_wood_front_right', x: 16, y: 96, w, h });
  frames.push({ name: 'desk_grey_2x1_left', x: 32, y: 80, w, h });
  frames.push({ name: 'desk_grey_2x1_right', x: 48, y: 80, w, h });
  frames.push({ name: 'desk_white_small', x: 64, y: 80, w, h: 32 });

  // ==========================================================================
  // COMPUTERS & MONITORS (row 3-4)
  // ==========================================================================
  frames.push({ name: 'monitor_modern', x: 128, y: 48, w, h });
  frames.push({ name: 'monitor_screen', x: 144, y: 48, w, h });
  frames.push({ name: 'laptop_open', x: 160, y: 48, w, h });
  frames.push({ name: 'laptop_closed', x: 176, y: 48, w, h });
  frames.push({ name: 'keyboard_modern', x: 128, y: 64, w, h });
  frames.push({ name: 'mouse', x: 144, y: 64, w: 8, h: 8 });
  frames.push({ name: 'dual_monitors', x: 128, y: 80, w: 32, h: 16 });

  // ==========================================================================
  // PLANTS (various rows)
  // ==========================================================================
  frames.push({ name: 'plant_small_pot', x: 64, y: 48, w, h });
  frames.push({ name: 'plant_desk', x: 80, y: 48, w, h });
  frames.push({ name: 'plant_tall', x: 224, y: 192, w, h: 32 });
  frames.push({ name: 'plant_floor_large', x: 240, y: 192, w, h: 32 });

  // ==========================================================================
  // OFFICE SUPPLIES & DECORATIONS
  // ==========================================================================
  frames.push({ name: 'papers_stack', x: 192, y: 48, w, h });
  frames.push({ name: 'folder', x: 208, y: 48, w, h });
  frames.push({ name: 'coffee_mug', x: 224, y: 48, w, h });
  frames.push({ name: 'pencil_cup', x: 240, y: 48, w, h });
  frames.push({ name: 'phone_desk', x: 192, y: 64, w, h });
  frames.push({ name: 'lamp_desk_modern', x: 208, y: 64, w, h: 32 });
  frames.push({ name: 'picture_frame', x: 192, y: 80, w: 16, h: 16 });
  frames.push({ name: 'award_plaque', x: 208, y: 80, w, h });
  frames.push({ name: 'calendar', x: 224, y: 80, w, h });
  frames.push({ name: 'clock_wall', x: 240, y: 80, w, h });

  // ==========================================================================
  // BOOKSHELVES & STORAGE (row 7-9)
  // ==========================================================================
  frames.push({ name: 'bookshelf_3x3', x: 0, y: 112, w: 48, h: 48 });
  frames.push({ name: 'bookshelf_2x3', x: 48, y: 112, w: 32, h: 48 });
  frames.push({ name: 'filing_cabinet_2', x: 80, y: 112, w: 16, h: 32 });
  frames.push({ name: 'filing_cabinet_3', x: 96, y: 112, w: 16, h: 48 });

  // ==========================================================================
  // WHITEBOARDS & PRESENTATION (row 5-6)
  // ==========================================================================
  frames.push({ name: 'whiteboard_3x2', x: 112, y: 80, w: 48, h: 32 });
  frames.push({ name: 'corkboard_2x2', x: 160, y: 80, w: 32, h: 32 });
  frames.push({ name: 'presentation_screen', x: 112, y: 112, w: 48, h: 48 });

  // ==========================================================================
  // SERVER RACK & ELECTRONICS (various rows)
  // ==========================================================================
  frames.push({ name: 'server_rack_3x4', x: 224, y: 112, w: 32, h: 64 });
  frames.push({ name: 'printer', x: 192, y: 112, w: 32, h: 32 });
  frames.push({ name: 'scanner', x: 192, y: 144, w: 32, h: 16 });

  // ==========================================================================
  // BREAK ROOM ITEMS
  // ==========================================================================
  frames.push({ name: 'water_cooler', x: 160, y: 160, w: 16, h: 32 });
  frames.push({ name: 'vending_machine', x: 176, y: 160, w: 32, h: 48 });
  frames.push({ name: 'coffee_machine', x: 208, y: 160, w: 16, h: 32 });
  frames.push({ name: 'microwave', x: 224, y: 160, w: 16, h: 16 });
  frames.push({ name: 'fridge', x: 240, y: 160, w: 16, h: 32 });

  // ==========================================================================
  // COUCHES & SEATING (row 10-11)
  // ==========================================================================
  frames.push({ name: 'couch_grey_3x1', x: 0, y: 160, w: 48, h: 32 });
  frames.push({ name: 'couch_blue_3x1', x: 48, y: 160, w: 48, h: 32 });
  frames.push({ name: 'armchair_grey', x: 96, y: 160, w: 16, h: 32 });
  frames.push({ name: 'armchair_blue', x: 112, y: 160, w: 16, h: 32 });
  frames.push({ name: 'coffee_table', x: 128, y: 176, w: 32, h: 16 });

  // ==========================================================================
  // AC UNIT & CEILING (top area)
  // ==========================================================================
  frames.push({ name: 'ac_unit', x: 128, y: 0, w: 48, h: 16 });
  frames.push({ name: 'ceiling_light', x: 176, y: 0, w: 32, h: 16 });
  frames.push({ name: 'vent', x: 208, y: 0, w: 16, h: 16 });

  return frames;
}

/**
 * Office Room Builder Frames
 */
function createOfficeRoomFrames(): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 16;
  const cols = 16;
  const rows = 16;

  // Grid-based frames
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      frames.push({ name: `officeroom_${row}_${col}`, x: col * w, y: row * h, w, h });
    }
  }

  // Office-specific wall panels
  frames.push({ name: 'wall_office_grey_top', x: 0, y: 0, w, h });
  frames.push({ name: 'wall_office_grey_bottom', x: 0, y: 16, w, h });
  frames.push({ name: 'wall_office_blue_top', x: 16, y: 0, w, h });
  frames.push({ name: 'wall_office_blue_bottom', x: 16, y: 16, w, h });

  // Office floor tiles
  frames.push({ name: 'floor_office_carpet', x: 128, y: 64, w, h });
  frames.push({ name: 'floor_office_tile', x: 144, y: 64, w, h });
  frames.push({ name: 'floor_office_wood', x: 160, y: 64, w, h });

  return frames;
}

/**
 * Premade Character Frames
 * Full animation sheets with idle, run, sit, etc.
 * Layout: Multiple rows for different animations
 */
function createPremadeCharacterFrames(prefix: string): FrameData[] {
  const frames: FrameData[] = [];
  const w = 16;
  const h = 32;

  // Row 0: Idle animation (down) - 4 frames
  for (let i = 0; i < 4; i++) {
    frames.push({ name: `${prefix}_idle_down_${i}`, x: i * w, y: 0, w, h });
  }

  // Row 1: Run animation (down) - 6 frames typically
  for (let i = 0; i < 6; i++) {
    frames.push({ name: `${prefix}_run_down_${i}`, x: i * w, y: h, w, h });
  }

  // Row 2: Idle animation (left/right) - 4 frames each
  for (let i = 0; i < 4; i++) {
    frames.push({ name: `${prefix}_idle_left_${i}`, x: i * w, y: h * 2, w, h });
  }
  for (let i = 0; i < 4; i++) {
    frames.push({ name: `${prefix}_idle_right_${i}`, x: (i + 4) * w, y: h * 2, w, h });
  }

  // Row 3: Run animation (left/right)
  for (let i = 0; i < 6; i++) {
    frames.push({ name: `${prefix}_run_left_${i}`, x: i * w, y: h * 3, w, h });
  }
  for (let i = 0; i < 6; i++) {
    frames.push({ name: `${prefix}_run_right_${i}`, x: (i + 6) * w, y: h * 3, w, h });
  }

  // Row 4: Idle animation (up) - 4 frames
  for (let i = 0; i < 4; i++) {
    frames.push({ name: `${prefix}_idle_up_${i}`, x: i * w, y: h * 4, w, h });
  }

  // Row 5: Run animation (up)
  for (let i = 0; i < 6; i++) {
    frames.push({ name: `${prefix}_run_up_${i}`, x: i * w, y: h * 5, w, h });
  }

  // Row 6: Sit animation
  for (let i = 0; i < 6; i++) {
    frames.push({ name: `${prefix}_sit_${i}`, x: i * w, y: h * 6, w, h });
  }

  // Convenience aliases
  frames.push({ name: `${prefix}_idle_0`, x: 0, y: 0, w, h });
  frames.push({ name: `${prefix}_idle_1`, x: w, y: 0, w, h });
  frames.push({ name: `${prefix}_run_0`, x: 0, y: h, w, h });
  frames.push({ name: `${prefix}_run_1`, x: w, y: h, w, h });

  return frames;
}

/**
 * Get premade character animation frame
 */
export function getPremadeCharFrame(charIndex: number, animation: string, time: number, direction = 'down'): string {
  const prefix = `char0${(charIndex % 6) + 1}`;

  if (animation === 'idle') {
    const frameIndex = Math.floor(time / 200) % 4;
    return `${prefix}_idle_${direction}_${frameIndex}`;
  } else if (animation === 'run') {
    const frameIndex = Math.floor(time / 100) % 6;
    return `${prefix}_run_${direction}_${frameIndex}`;
  } else if (animation === 'sit') {
    const frameIndex = Math.floor(time / 300) % 6;
    return `${prefix}_sit_${frameIndex}`;
  }

  return `${prefix}_idle_0`;
}
