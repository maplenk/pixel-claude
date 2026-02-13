import * as PIXI from 'pixi.js';
import type { Mode } from '../types';
import type { AppState } from '../store/state';
import { ART_CONFIG } from '../types';

const { internalWidth: IW, internalHeight: IH } = ART_CONFIG;

const UI = {
  panel: 0x141b2b,
  panelLight: 0x24304a,
  panelDark: 0x0b0f19,
  panelInset: 0x0f1422,
  text: 0xe0e0e0,
  textDim: 0x9aa3b2,
  accent: 0x00ff88,
  warning: 0xffaa00,
  error: 0xff4a4a,
};

interface BarRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OverlayUI {
  container: PIXI.Container;
  agentsText: PIXI.Text;
  usageText: PIXI.Text;
  tokensText: PIXI.Text;
  tokensBarFill: PIXI.Graphics;
  stateTexts: Map<Mode, PIXI.Text>;
  barRect: BarRect;
}

export function buildOverlayUI(iconTextures: Record<Mode, PIXI.Texture | null>): OverlayUI {
  const uiContainer = new PIXI.Container();
  const pad = 4;
  const topLeft = { x: pad, y: pad, w: 92, h: 28 };
  const topRight = { x: IW - pad - 78, y: pad, w: 78, h: 24 };
  const bottom = { x: pad, y: IH - pad - 18, w: 150, h: 18 };

  const panelTopLeft = new PIXI.Graphics();
  drawPanel(panelTopLeft, topLeft.x, topLeft.y, topLeft.w, topLeft.h, false);
  uiContainer.addChild(panelTopLeft);

  const titleText = new PIXI.Text('PIXELHQ', {
    fontFamily: 'monospace',
    fontSize: 7,
    fill: UI.text,
    fontWeight: '700',
  });
  titleText.position.set(topLeft.x + 4, topLeft.y + 2);
  titleText.roundPixels = true;
  uiContainer.addChild(titleText);

  const agentsText = new PIXI.Text('Agents: 1 (1 main + 0 sub)', {
    fontFamily: 'monospace',
    fontSize: 5,
    fill: UI.textDim,
  });
  agentsText.position.set(topLeft.x + 4, topLeft.y + 12);
  agentsText.roundPixels = true;
  uiContainer.addChild(agentsText);

  const usageText = new PIXI.Text('Usage: 0% | WS LOST', {
    fontFamily: 'monospace',
    fontSize: 5,
    fill: UI.textDim,
  });
  usageText.position.set(topLeft.x + 4, topLeft.y + 20);
  usageText.roundPixels = true;
  uiContainer.addChild(usageText);

  const panelTopRight = new PIXI.Graphics();
  drawPanel(panelTopRight, topRight.x, topRight.y, topRight.w, topRight.h, false);
  uiContainer.addChild(panelTopRight);

  const trackerTitle = new PIXI.Text('TRACKERS', {
    fontFamily: 'monospace',
    fontSize: 6,
    fill: UI.text,
  });
  trackerTitle.position.set(topRight.x + 4, topRight.y + 2);
  trackerTitle.roundPixels = true;
  uiContainer.addChild(trackerTitle);

  const barRect = {
    x: topRight.x + 4,
    y: topRight.y + 12,
    w: topRight.w - 8,
    h: 6,
  };

  const barBg = new PIXI.Graphics();
  drawPanel(barBg, barRect.x, barRect.y, barRect.w, barRect.h, true);
  uiContainer.addChild(barBg);

  const tokensBarFill = new PIXI.Graphics();
  uiContainer.addChild(tokensBarFill);

  const tokensText = new PIXI.Text('Tokens: 0%', {
    fontFamily: 'monospace',
    fontSize: 4,
    fill: UI.textDim,
  });
  tokensText.position.set(barRect.x + 2, barRect.y + 1);
  tokensText.roundPixels = true;
  uiContainer.addChild(tokensText);

  const panelBottom = new PIXI.Graphics();
  drawPanel(panelBottom, bottom.x, bottom.y, bottom.w, bottom.h, false);
  uiContainer.addChild(panelBottom);

  const statesLabel = new PIXI.Text('STATES', {
    fontFamily: 'monospace',
    fontSize: 5,
    fill: UI.textDim,
  });
  statesLabel.position.set(bottom.x + 4, bottom.y + 3);
  statesLabel.roundPixels = true;
  uiContainer.addChild(statesLabel);

  const states: { mode: Mode; label: string }[] = [
    { mode: 'idle', label: 'IDLE' },
    { mode: 'typing', label: 'TYPING' },
    { mode: 'thinking', label: 'THINKING' },
    { mode: 'running', label: 'RUNNING' },
    { mode: 'celebrate', label: 'DONE' },
  ];

  const stateTexts = new Map<Mode, PIXI.Text>();
  let sx = bottom.x + 36;
  for (const st of states) {
    const iconTexture = iconTextures[st.mode];
    if (iconTexture) {
      const icon = new PIXI.Sprite(iconTexture);
      icon.position.set(sx - 10, bottom.y + 1);
      icon.roundPixels = true;
      uiContainer.addChild(icon);
    }

    const label = new PIXI.Text(st.label, {
      fontFamily: 'monospace',
      fontSize: 5,
      fill: UI.textDim,
    });
    label.position.set(sx, bottom.y + 12);
    label.roundPixels = true;
    uiContainer.addChild(label);
    stateTexts.set(st.mode, label);
    sx += Math.ceil(label.width) + 6;
  }

  return {
    container: uiContainer,
    agentsText,
    usageText,
    tokensText,
    tokensBarFill,
    stateTexts,
    barRect,
  };
}

export function updateOverlayUI(ui: OverlayUI, state: AppState): void {
  const subCount = state.agents.size;
  const totalAgents = subCount + 1;
  ui.agentsText.text = `Agents: ${totalAgents} (1 main + ${subCount} sub)`;

  const tokens = state.tokens.totalInput + state.tokens.totalOutput;
  const budget = state.estimatedTokenBudget || 100000;
  const usagePct = Math.floor(Math.min(1, tokens / budget) * 100);
  const connected = state.connectionState === 'connected' || state.connectionState === 'authenticated';
  ui.usageText.text = `Usage: ${usagePct}% | WS ${connected ? 'OK' : 'LOST'}`;

  const progress = Math.min(1, tokens / budget);
  const progressColor = progress < 0.6 ? UI.accent : progress < 0.85 ? UI.warning : UI.error;
  ui.tokensBarFill.clear();
  ui.tokensBarFill.beginFill(progressColor);
  const progressW = Math.floor((ui.barRect.w - 2) * progress);
  ui.tokensBarFill.drawRect(ui.barRect.x + 1, ui.barRect.y + 1, progressW, ui.barRect.h - 2);
  ui.tokensBarFill.endFill();

  ui.tokensText.text = `Tokens: ${usagePct}%`;

  for (const [mode, text] of ui.stateTexts) {
    text.style.fill = state.mode === mode ? UI.accent : UI.textDim;
  }
}

function drawPanel(g: PIXI.Graphics, x: number, y: number, w: number, h: number, inset: boolean) {
  g.beginFill(inset ? UI.panelInset : UI.panel, 1);
  g.drawRect(x, y, w, h);
  g.endFill();

  g.beginFill(UI.panelLight, 1);
  g.drawRect(x, y, w, 1);
  g.drawRect(x, y, 1, h);
  g.endFill();

  g.beginFill(UI.panelDark, 1);
  g.drawRect(x, y + h - 1, w, 1);
  g.drawRect(x + w - 1, y, 1, h);
  g.endFill();
}
