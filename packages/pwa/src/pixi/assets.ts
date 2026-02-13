import * as PIXI from 'pixi.js';
import type { Mode } from '../types';

export interface PremadeAtlas {
  base: PIXI.BaseTexture;
  frames: Map<string, PIXI.Texture>;
}

export async function loadTexture(url: string): Promise<PIXI.Texture | null> {
  try {
    const texture = (await PIXI.Assets.load(url)) as PIXI.Texture;
    if (texture?.baseTexture) {
      texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    }
    return texture ?? null;
  } catch {
    return null;
  }
}

export async function loadOfficeDesignTexture(prefer: 'design2' | 'design1' = 'design2'): Promise<PIXI.Texture | null> {
  const primary = prefer === 'design2'
    ? '/sprites/limezu/office/Office_Design_2.png'
    : '/sprites/limezu/office/Office_Design_1.png';
  const fallback = prefer === 'design2'
    ? '/sprites/limezu/office/Office_Design_1.png'
    : '/sprites/limezu/office/Office_Design_2.png';

  const primaryTex = await loadTexture(primary);
  if (primaryTex) return primaryTex;
  return loadTexture(fallback);
}

export async function loadUiIconTextures(): Promise<Record<Mode, PIXI.Texture | null>> {
  const icons: Record<Mode, string> = {
    idle: '/sprites/limezu/ui/bubble_empty.png',
    typing: '/sprites/limezu/ui/bubble_screen.png',
    thinking: '/sprites/limezu/ui/bubble_question.png',
    running: '/sprites/limezu/ui/bubble_alert.png',
    celebrate: '/sprites/limezu/ui/bubble_heart.png',
    error: '/sprites/limezu/ui/bubble_exclaim.png',
  };

  const results: Record<Mode, PIXI.Texture | null> = {
    idle: null,
    typing: null,
    thinking: null,
    running: null,
    celebrate: null,
    error: null,
  };

  await Promise.all(
    (Object.keys(icons) as Mode[]).map(async (mode) => {
      results[mode] = await loadTexture(icons[mode]);
    })
  );

  return results;
}

export async function loadPremadeAtlases(): Promise<PremadeAtlas[]> {
  const urls = [
    '/sprites/limezu/Premade_Character_01.png',
    '/sprites/limezu/Premade_Character_02.png',
    '/sprites/limezu/Premade_Character_03.png',
    '/sprites/limezu/Premade_Character_04.png',
    '/sprites/limezu/Premade_Character_05.png',
    '/sprites/limezu/Premade_Character_06.png',
  ];

  const atlases: PremadeAtlas[] = [];
  for (const url of urls) {
    const tex = await loadTexture(url);
    if (!tex) continue;
    const base = tex.baseTexture;
    atlases.push({ base, frames: createPremadeFrames(base) });
  }

  if (atlases.length === 0) {
    const fallback = PIXI.Texture.WHITE.baseTexture;
    atlases.push({ base: fallback, frames: new Map() });
  }

  return atlases;
}

export function createPremadeFrames(base: PIXI.BaseTexture): Map<string, PIXI.Texture> {
  const frames = new Map<string, PIXI.Texture>();
  const w = 16;
  const h = 32;

  const add = (key: string, x: number, y: number) => {
    frames.set(key, new PIXI.Texture(base, new PIXI.Rectangle(x, y, w, h)));
  };

  for (let i = 0; i < 4; i++) {
    add(`idle_down_${i}`, i * w, 0);
  }
  for (let i = 0; i < 6; i++) {
    add(`run_down_${i}`, i * w, h);
  }
  for (let i = 0; i < 4; i++) {
    add(`idle_left_${i}`, i * w, h * 2);
  }
  for (let i = 0; i < 4; i++) {
    add(`idle_right_${i}`, (i + 4) * w, h * 2);
  }
  for (let i = 0; i < 6; i++) {
    add(`run_left_${i}`, i * w, h * 3);
  }
  for (let i = 0; i < 6; i++) {
    add(`run_right_${i}`, (i + 6) * w, h * 3);
  }
  for (let i = 0; i < 4; i++) {
    add(`idle_up_${i}`, i * w, h * 4);
  }
  for (let i = 0; i < 6; i++) {
    add(`run_up_${i}`, i * w, h * 5);
  }
  for (let i = 0; i < 6; i++) {
    add(`sit_${i}`, i * w, h * 6);
  }

  return frames;
}

export function getPremadeFrameKey(animation: string, time: number, direction: string): string {
  if (animation === 'run') {
    const frameIndex = Math.floor(time / 100) % 6;
    return `run_${direction}_${frameIndex}`;
  }
  const frameIndex = Math.floor(time / 200) % 4;
  return `idle_${direction}_${frameIndex}`;
}

export function cropTexture(
  texture: PIXI.Texture,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
  snap = 1
): PIXI.Texture {
  const base = texture.baseTexture;
  const cropW = Math.min(width, base.width);
  const cropH = Math.min(height, base.height);
  let baseX = Math.floor((base.width - cropW) * 0.5) + offsetX;
  let baseY = Math.floor((base.height - cropH) * 0.5) + offsetY;
  if (snap > 1) {
    baseX = Math.floor(baseX / snap) * snap;
    baseY = Math.floor(baseY / snap) * snap;
  }
  const cropX = Math.max(0, Math.min(base.width - cropW, baseX));
  const cropY = Math.max(0, Math.min(base.height - cropH, baseY));
  return new PIXI.Texture(base, new PIXI.Rectangle(cropX, cropY, cropW, cropH));
}
