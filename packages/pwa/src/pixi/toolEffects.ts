import * as PIXI from 'pixi.js';
import type { AppState } from '../store/state';
import type { ToolCategory } from '../types';

export interface ToolEffectController {
  update: (state: AppState, time: number) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const COLORS = {
  active: 0x00ff88,
  completed: 0x4aa3ff,
  error: 0xff4a4a,
};

export function createCabinetToolEffect(
  layer: PIXI.Container,
  rect: Rect,
  category: ToolCategory = 'FILE_WRITE'
): ToolEffectController {
  const glow = new PIXI.Graphics();
  const icon = new PIXI.Graphics();
  glow.visible = false;
  icon.visible = false;
  layer.addChild(glow, icon);

  return {
    update(state: AppState, time: number) {
      const tool = state.currentTool;
      const active = Boolean(tool && tool.category === category);
      if (!active) {
        glow.visible = false;
        icon.visible = false;
        return;
      }

      const status = tool!.status;
      const color = status === 'error' ? COLORS.error : status === 'completed' ? COLORS.completed : COLORS.active;
      const pulse = 0.4 + Math.sin(time / 160) * 0.3;

      glow.visible = true;
      glow.clear();
      glow.lineStyle(1, color, 0.9);
      glow.beginFill(color, 0.15 + pulse * 0.15);
      glow.drawRect(rect.x, rect.y, rect.w, rect.h);
      glow.endFill();

      icon.visible = true;
      icon.clear();
      icon.beginFill(0xffffff, 0.95);
      icon.drawRect(0, 0, 8, 10);
      icon.endFill();
      icon.beginFill(0xdde6ff, 1);
      icon.drawRect(1, 1, 6, 8);
      icon.endFill();
      icon.beginFill(0xb9c7e6, 1);
      icon.drawRect(5, 1, 2, 2);
      icon.endFill();

      const float = Math.sin(time / 220) * 2;
      icon.position.set(Math.round(rect.x + rect.w / 2 - 4), Math.round(rect.y - 12 + float));
    },
  };
}
