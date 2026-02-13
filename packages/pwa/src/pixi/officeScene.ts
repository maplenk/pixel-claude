import * as PIXI from 'pixi.js';
import type { AppState, AgentInfo } from '../store/state';
import type { Mode, Activity } from '../types';
import { ART_CONFIG } from '../types';
import {
  cropTexture,
  getPremadeFrameKey,
  loadOfficeDesignTexture,
  loadPremadeAtlases,
  loadUiIconTextures,
  type PremadeAtlas,
} from './assets';
import { buildOverlayUI, updateOverlayUI } from './ui';
import { createCabinetToolEffect } from './toolEffects';

const { internalWidth: IW, internalHeight: IH } = ART_CONFIG;

const OFFICE_POSITIONS: Record<Mode, { x: number; y: number }> = {
  idle: { x: Math.round(IW * 0.5), y: 200 },
  typing: { x: Math.round(IW * 0.5), y: 245 },
  thinking: { x: Math.round(IW * 0.5), y: 130 },
  running: { x: Math.round(IW * 0.55), y: 195 },
  celebrate: { x: Math.round(IW * 0.5), y: 290 },
  error: { x: Math.round(IW * 0.5), y: 200 },
};

const MOVE_SPEED = 1.6;
const OFFICE_CROP_OFFSET = { x: 0, y: 0 };
const OFFICE_CABINET = { x: 24, y: 236, w: 20, h: 24 };

export interface PixiOfficeScene {
  container: PIXI.Container;
  setState: (state: AppState) => void;
  update: (time: number) => void;
}

export async function createPixiOfficeScene(initialState: AppState): Promise<PixiOfficeScene> {
  const container = new PIXI.Container();
  const backgroundLayer = new PIXI.Container();
  const actorLayer = new PIXI.Container();
  const uiLayer = new PIXI.Container();
  container.addChild(backgroundLayer, actorLayer, uiLayer);

  const [designTexture, uiIconTextures, premadeAtlases] = await Promise.all([
    loadOfficeDesignTexture('design1'),
    loadUiIconTextures(),
    loadPremadeAtlases(),
  ]);

  if (designTexture) {
    const cropped = cropTexture(
      designTexture,
      IW,
      IH,
      OFFICE_CROP_OFFSET.x,
      OFFICE_CROP_OFFSET.y,
      16
    );
    const bg = new PIXI.Sprite(cropped);
    bg.x = 0;
    bg.y = 0;
    bg.roundPixels = true;
    backgroundLayer.addChild(bg);
  }

  const ui = buildOverlayUI(uiIconTextures);
  uiLayer.addChild(ui.container);

  const cabinetEffect = createCabinetToolEffect(actorLayer, OFFICE_CABINET, 'FILE_WRITE');

  const mainCharAtlas = premadeAtlases[0];
  const mainChar = new PIXI.Sprite();
  mainChar.anchor.set(0.5, 1);
  mainChar.roundPixels = true;
  actorLayer.addChild(mainChar);
  const mainBubble = new PIXI.Sprite();
  mainBubble.anchor.set(0.5, 1);
  mainBubble.roundPixels = true;
  mainBubble.visible = false;
  actorLayer.addChild(mainBubble);

  const subAgentSprites = new Map<string, PIXI.Sprite>();

  let state = initialState;
  let charX = OFFICE_POSITIONS.idle.x;
  let charY = OFFICE_POSITIONS.idle.y;

  function setState(next: AppState) {
    state = next;
  }

  function update(time: number) {
    const target = getOfficeTarget(state.mode, state.activity);
    const dx = target.x - charX;
    const dy = target.y - charY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > MOVE_SPEED) {
      charX += (dx / dist) * MOVE_SPEED;
      charY += (dy / dist) * MOVE_SPEED;
    } else {
      charX = target.x;
      charY = target.y;
    }

    const isWalking = Math.abs(target.x - charX) > 2 || Math.abs(target.y - charY) > 2;
    const isTyping = state.mode === 'typing' || state.activity === 'responding';
    const isThinking = state.mode === 'thinking' || state.activity === 'thinking';
    const isRunning = state.mode === 'running';
    const isCelebrate = state.mode === 'celebrate';
    const isError = state.mode === 'error';

    let direction: 'up' | 'down' | 'left' | 'right' = 'down';
    let texture: PIXI.Texture | undefined;

    if (isTyping) {
      const sitFrame = Math.floor(time / 300) % 6;
      texture = mainCharAtlas.frames.get(`sit_${sitFrame}`);
    } else if (isWalking || isRunning) {
      direction = dx >= 0 ? 'right' : 'left';
      const frameKey = getPremadeFrameKey('run', time, direction);
      texture = mainCharAtlas.frames.get(frameKey);
    } else {
      direction = isThinking ? 'up' : 'down';
      const frameKey = getPremadeFrameKey('idle', time, direction);
      texture = mainCharAtlas.frames.get(frameKey);
    }

    if (!texture) {
      texture = mainCharAtlas.frames.get('idle_down_0');
    }
    if (texture) {
      mainChar.texture = texture;
    }
    const bob = isCelebrate ? -Math.abs(Math.sin(time / 200) * 3) : 0;
    const shake = isError ? Math.sin(time / 80) * 1.5 : 0;
    mainChar.position.set(Math.round(charX + shake), Math.round(charY + bob));

    const bubbleTexture = isThinking
      ? uiIconTextures.thinking
      : isTyping
        ? uiIconTextures.typing
        : isRunning
          ? uiIconTextures.running
          : isCelebrate
            ? uiIconTextures.celebrate
            : isError
              ? uiIconTextures.error
              : null;

    if (bubbleTexture) {
      mainBubble.visible = true;
      mainBubble.texture = bubbleTexture;
      const float = isThinking ? Math.sin(time / 300) * 2 : 0;
      const rawX = Math.round(charX + 12);
      const rawY = Math.round(charY - 34 + float);
      const clampedX = Math.max(8, Math.min(IW - 8, rawX));
      const clampedY = Math.max(18, rawY);
      mainBubble.position.set(clampedX, clampedY);
    } else {
      mainBubble.visible = false;
    }

    syncSubAgents(actorLayer, subAgentSprites, premadeAtlases, state.agents, time);
    updateOverlayUI(ui, state);
    cabinetEffect.update(state, time);
  }

  return { container, setState, update };
}

function getOfficeTarget(mode: Mode, activity: Activity): { x: number; y: number } {
  if (mode !== 'idle') {
    return OFFICE_POSITIONS[mode] || OFFICE_POSITIONS.idle;
  }

  switch (activity) {
    case 'thinking':
      return OFFICE_POSITIONS.thinking;
    case 'responding':
      return OFFICE_POSITIONS.typing;
    case 'waiting':
      return OFFICE_POSITIONS.idle;
    default:
      return OFFICE_POSITIONS.idle;
  }
}

function syncSubAgents(
  container: PIXI.Container,
  sprites: Map<string, PIXI.Sprite>,
  atlases: PremadeAtlas[],
  agents: Map<string, AgentInfo>,
  time: number
) {
  const seen = new Set<string>();
  for (const [id, agent] of agents) {
    seen.add(id);
    let sprite = sprites.get(id);
    if (!sprite) {
      sprite = new PIXI.Sprite();
      sprite.anchor.set(0.5, 1);
      sprite.roundPixels = true;
      sprites.set(id, sprite);
      container.addChild(sprite);
    }

    const atlas = atlases[agent.characterIndex % atlases.length];
    const isWalking = agent.animState === 'walking_in' || agent.animState === 'walking_out';
    const isBusy = agent.status === 'running';
    const direction = isWalking ? (agent.targetX > agent.x ? 'right' : 'left') : 'down';
    const anim = isWalking || isBusy ? 'run' : 'idle';
    const frameKey = getPremadeFrameKey(anim, time, direction);
    const texture = atlas.frames.get(frameKey) || atlas.frames.get('idle_down_0');
    if (texture) {
      sprite.texture = texture;
    }

    if (agent.status === 'error') {
      sprite.tint = 0xff6666;
    } else {
      sprite.tint = 0xffffff;
    }

    sprite.position.set(Math.round(agent.x), Math.round(agent.y));
  }

  for (const [id, sprite] of sprites) {
    if (!seen.has(id)) {
      sprite.parent?.removeChild(sprite);
      sprites.delete(id);
    }
  }
}
