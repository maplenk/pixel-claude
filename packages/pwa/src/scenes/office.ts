import type { Mode } from '../types';
import { ART_CONFIG } from '../types';
import { MODE_COLORS } from '../engine/sprites';

const { internalWidth: IW, internalHeight: IH } = ART_CONFIG;

// Color palette
const P = {
  sky: '#0a1628', skyMid: '#152238', skyLight: '#1e3a5f',
  lanternGlow: '#ff6b35', lanternBody: '#c1121f', lanternLight: '#ffd166', lanternDark: '#8b0000',
  wood: '#8b5a2b', woodLight: '#a67c52', woodDark: '#5d3a1a', woodHighlight: '#c4956a',
  counter: '#6d4c41', counterTop: '#8b7355', counterDark: '#4a3728',
  pot: '#3d4f5f', potDark: '#2d3a47', potHighlight: '#5a6f7f',
  flame1: '#ff6b35', flame2: '#ffd166', flame3: '#ff8c42', broth: '#d4a574', brothDark: '#b8956a',
  scroll: '#f5f0e1', scrollDark: '#e8dcc8', scrollText: '#2d3748', scrollAccent: '#c1121f',
  board: '#deb887', boardDark: '#c9a66b', knife: '#d0d0d0', knifeDark: '#a0a0a0',
  noodles: '#f5deb3', veggies: '#68d391', veggiesDark: '#48bb78',
  bowl: '#fff', bowlShadow: '#ddd', egg: '#ffd700', eggDark: '#daa520', nori: '#2d5016',
  noren: '#c1121f', norenDark: '#8b0000', norenLight: '#e63946',
  skin: '#ffd9b3', skinDark: '#e6c49f', hair: '#1a1a2e', headband: '#c1121f', headbandLight: '#e63946',
  outfit: '#2d3748', outfitDark: '#1a202c', apron: '#fff', apronShadow: '#ddd',
  shadow: 'rgba(0,0,0,0.3)', shadowLight: 'rgba(0,0,0,0.15)',
};

// Character position
let mx = IW * 0.5, my = IH * 0.5, tx = mx, ty = my;

let currentMode: Mode = 'idle';

export function drawOffice(ctx: CanvasRenderingContext2D, mode: Mode, time: number): void {
  currentMode = mode;

  // Background
  nightSky(ctx, time);
  lanterns(ctx, time);
  stallSign(ctx);
  norenSign(ctx, time);

  // Work stations
  const scrollPos = menuScroll(ctx, time, mode);
  const potPos = potAndFlame(ctx, time, mode);
  const prepPos = prepBoard(ctx, time, mode);
  const counterPos = counter(ctx, time);
  steam(ctx, time, IW * 0.65, IH * 0.32, mode === 'running' ? 1.5 : 0.5);

  // Update target position based on mode
  if (mode === 'typing') { tx = prepPos.x; ty = prepPos.y; }
  else if (mode === 'thinking') { tx = scrollPos.x; ty = scrollPos.y; }
  else if (mode === 'running') { tx = potPos.x; ty = potPos.y; }
  else if (mode === 'celebrate') { tx = counterPos.x; ty = counterPos.y - 6; }
  else if (mode === 'error') { tx = prepPos.x; ty = prepPos.y; }
  else { tx = IW * 0.5; ty = IH * 0.5; }

  // Move character
  const dx = tx - mx, dy = ty - my, dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 1) { mx += dx / dist * 1.8; my += dy / dist * 1.8; }

  // Draw character
  ninjaCook(ctx, mx, my, time, mode);

  // Lighting & effects
  drawLighting(ctx, mode);
  vignette(ctx);
  foreground(ctx, time);

  // UI
  drawStatus(ctx, mode);
}

function nightSky(ctx: CanvasRenderingContext2D, t: number): void {
  // Layer 1: Deep sky gradient
  const g = ctx.createLinearGradient(0, 0, 0, IH * 0.5);
  g.addColorStop(0, '#0a0a1a');      // Deep navy at top
  g.addColorStop(0.3, '#0d1628');    // Dark blue
  g.addColorStop(0.6, '#152238');    // Midnight blue
  g.addColorStop(1, '#1e3a5f');      // Horizon blue
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, IW, IH * 0.5);

  // Stars - different sizes and twinkle rates
  for (let i = 0; i < 35; i++) {
    const twinkle = Math.sin(t / (300 + i * 20) + i * 37) > 0.3;
    const brightness = 0.3 + Math.sin(t / (200 + i * 15) + i * 23) * 0.4;
    if (twinkle) {
      ctx.fillStyle = `rgba(255,255,255,${brightness})`;
      const sx = (i * 31 + 7) % IW;
      const sy = 2 + (i * 11) % 50;
      const sz = i % 7 === 0 ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
    }
  }

  // Moon (subtle, small)
  const moonX = IW * 0.85;
  const moonY = 15;
  ctx.fillStyle = 'rgba(255,250,240,0.15)';
  ctx.beginPath();
  ctx.arc(moonX, moonY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,250,240,0.4)';
  ctx.beginPath();
  ctx.arc(moonX, moonY, 6, 0, Math.PI * 2);
  ctx.fill();

  // Layer 2: Distant mountain/hill silhouettes
  ctx.fillStyle = '#0d1520';
  ctx.beginPath();
  ctx.moveTo(0, IH * 0.25);
  ctx.lineTo(IW * 0.15, IH * 0.18);
  ctx.lineTo(IW * 0.3, IH * 0.22);
  ctx.lineTo(IW * 0.5, IH * 0.15);
  ctx.lineTo(IW * 0.7, IH * 0.2);
  ctx.lineTo(IW * 0.85, IH * 0.16);
  ctx.lineTo(IW, IH * 0.22);
  ctx.lineTo(IW, IH * 0.35);
  ctx.lineTo(0, IH * 0.35);
  ctx.fill();

  // Layer 3: City skyline silhouettes (tiled roofs and buildings)
  drawCitySkyline(ctx, t);

  // Layer 4: Atmosphere gradient over buildings
  const fogG = ctx.createLinearGradient(0, IH * 0.2, 0, IH * 0.45);
  fogG.addColorStop(0, 'rgba(30,58,95,0)');
  fogG.addColorStop(1, 'rgba(26,32,44,0.8)');
  ctx.fillStyle = fogG;
  ctx.fillRect(0, IH * 0.2, IW, IH * 0.25);
}

function drawCitySkyline(ctx: CanvasRenderingContext2D, t: number): void {
  // Distant buildings - dark silhouettes
  ctx.fillStyle = '#111822';

  // Building cluster 1 (left)
  ctx.fillRect(5, IH * 0.22, 12, IH * 0.13);
  ctx.fillRect(15, IH * 0.25, 8, IH * 0.1);
  ctx.fillRect(22, IH * 0.2, 10, IH * 0.15);

  // Building cluster 2 (center-left)
  ctx.fillRect(40, IH * 0.23, 15, IH * 0.12);
  ctx.fillRect(52, IH * 0.18, 8, IH * 0.17);
  ctx.fillRect(58, IH * 0.21, 12, IH * 0.14);

  // Building cluster 3 (center)
  ctx.fillRect(80, IH * 0.2, 10, IH * 0.15);
  ctx.fillRect(88, IH * 0.24, 14, IH * 0.11);

  // Building cluster 4 (center-right)
  ctx.fillRect(110, IH * 0.19, 12, IH * 0.16);
  ctx.fillRect(120, IH * 0.22, 8, IH * 0.13);

  // Building cluster 5 (right)
  ctx.fillRect(140, IH * 0.21, 15, IH * 0.14);
  ctx.fillRect(152, IH * 0.17, 10, IH * 0.18);
  ctx.fillRect(160, IH * 0.23, 12, IH * 0.12);

  // Japanese-style rooftops (pagoda hints)
  ctx.fillStyle = '#0d1018';
  // Pagoda roof 1
  drawPagodaRoof(ctx, 25, IH * 0.2, 14);
  // Pagoda roof 2
  drawPagodaRoof(ctx, 90, IH * 0.19, 12);
  // Pagoda roof 3
  drawPagodaRoof(ctx, 155, IH * 0.17, 16);

  // Distant window lights (very dim, warm)
  const windowPositions = [
    [8, IH * 0.26], [18, IH * 0.24], [45, IH * 0.27], [55, IH * 0.22],
    [85, IH * 0.25], [115, IH * 0.23], [145, IH * 0.25], [158, IH * 0.21]
  ];

  for (let i = 0; i < windowPositions.length; i++) {
    const [wx, wy] = windowPositions[i];
    const flicker = Math.sin(t / 800 + i * 1.7) > 0.2;
    if (flicker) {
      ctx.fillStyle = 'rgba(255,200,100,0.3)';
      ctx.fillRect(wx, wy, 2, 2);
    }
  }

  // Distant lanterns (very subtle, slow movement)
  drawDistantLanterns(ctx, t);
}

function drawPagodaRoof(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 3, y);
  ctx.lineTo(x, y - 6);
  ctx.lineTo(x + w / 2 + 3, y);
  ctx.fill();

  // Second tier
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - 5);
  ctx.lineTo(x, y - 9);
  ctx.lineTo(x + w / 2, y - 5);
  ctx.fill();
}

function drawDistantLanterns(ctx: CanvasRenderingContext2D, t: number): void {
  const lanternData = [
    { x: 35, y: IH * 0.32, size: 0.5 },
    { x: 75, y: IH * 0.34, size: 0.4 },
    { x: 130, y: IH * 0.31, size: 0.6 },
  ];

  for (const l of lanternData) {
    const sway = Math.sin(t / 1200 + l.x) * 0.5;
    const glow = 0.1 + Math.sin(t / 400 + l.x * 0.1) * 0.05;

    // Glow
    ctx.fillStyle = `rgba(255,120,50,${glow})`;
    ctx.beginPath();
    ctx.arc(l.x + sway, l.y, 6 * l.size, 0, Math.PI * 2);
    ctx.fill();

    // Lantern body
    ctx.fillStyle = `rgba(200,80,40,${0.4 * l.size})`;
    ctx.fillRect(l.x + sway - 2 * l.size, l.y - 3 * l.size, 4 * l.size, 6 * l.size);
  }
}

function lanterns(ctx: CanvasRenderingContext2D, t: number): void {
  const positions = [IW * 0.15, IW * 0.5, IW * 0.85];
  positions.forEach((lx, i) => {
    const sway = Math.sin(t / 800 + i * 1.7) * 1;
    const ly = 6 + i % 2 * 3;
    const size = i === 1 ? 1 : 0.85;

    // String
    ctx.strokeStyle = P.woodDark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + sway, ly); ctx.stroke();

    // Glow
    const glowBase = 0.15 + Math.sin(t / 150 + i * 2) * 0.08;
    ctx.fillStyle = `rgba(255,107,53,${glowBase * 0.5})`;
    ctx.beginPath(); ctx.arc(lx + sway, ly + 7 * size, 14 * size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,211,102,${glowBase})`;
    ctx.beginPath(); ctx.arc(lx + sway, ly + 7 * size, 8 * size, 0, Math.PI * 2); ctx.fill();

    // Lantern body
    const lw = 8 * size, lh = 12 * size;
    ctx.fillStyle = P.lanternDark;
    ctx.fillRect(lx + sway - lw / 2, ly, lw, lh);
    ctx.fillStyle = P.lanternBody;
    ctx.fillRect(lx + sway - lw / 2 + 1, ly, lw - 2, lh);
    ctx.fillStyle = P.lanternLight;
    ctx.globalAlpha = 0.4 + Math.sin(t / 120 + i) * 0.2;
    ctx.fillRect(lx + sway - lw / 2 + 2, ly + 2, lw - 4, lh - 4);
    ctx.globalAlpha = 1;

    // Caps
    ctx.fillStyle = P.woodDark;
    ctx.fillRect(lx + sway - lw / 2 - 1, ly - 1, lw + 2, 2);
    ctx.fillRect(lx + sway - lw / 2 - 1, ly + lh - 1, lw + 2, 2);
  });
}

function norenSign(ctx: CanvasRenderingContext2D, t: number): void {
  const y = 38, norenW = 10, gap = 2, count = 7;
  const totalW = count * norenW + (count - 1) * gap;
  const startX = IW / 2 - totalW / 2;

  for (let i = 0; i < count; i++) {
    const nx = startX + i * (norenW + gap) + norenW / 2;
    const sway = Math.sin(t / 600 + i * 0.8) * 0.8;
    const h = 14 + i % 2 * 2;

    ctx.fillStyle = P.norenDark;
    ctx.beginPath();
    ctx.moveTo(nx - norenW / 2 + 1, y);
    ctx.lineTo(nx - norenW / 2 + 2 + sway, y + h);
    ctx.lineTo(nx + norenW / 2 + sway, y + h);
    ctx.lineTo(nx + norenW / 2 - 1, y);
    ctx.fill();

    ctx.fillStyle = P.noren;
    ctx.beginPath();
    ctx.moveTo(nx - norenW / 2, y);
    ctx.lineTo(nx - norenW / 2 + 1 + sway, y + h - 1);
    ctx.lineTo(nx + norenW / 2 - 1 + sway, y + h - 1);
    ctx.lineTo(nx + norenW / 2, y);
    ctx.fill();

    ctx.fillStyle = P.norenLight;
    ctx.fillRect(nx - norenW / 2 + 1, y + 1, 2, h / 2);
  }

  ctx.fillStyle = P.woodDark;
  ctx.fillRect(startX - 3, y - 2, totalW + 6, 3);
}

function stallSign(ctx: CanvasRenderingContext2D): void {
  const name = 'Ninja Noodles';
  const sw = name.length * 5 + 12, sx = IW / 2 - sw / 2, sy = 22;

  ctx.fillStyle = P.shadow;
  ctx.fillRect(sx + 2, sy + 2, sw, 14);

  ctx.fillStyle = P.woodDark;
  ctx.fillRect(sx - 2, sy - 2, sw + 4, 18);
  ctx.fillStyle = P.wood;
  ctx.fillRect(sx - 1, sy - 1, sw + 2, 16);
  ctx.fillStyle = P.woodHighlight;
  ctx.fillRect(sx, sy, sw, 1);

  ctx.fillStyle = P.scroll;
  ctx.fillRect(sx, sy, sw, 12);
  ctx.fillStyle = P.scrollDark;
  ctx.fillRect(sx, sy + 10, sw, 2);

  ctx.fillStyle = P.shadowLight;
  ctx.font = 'bold 7px monospace';
  ctx.fillText(name, sx + 7, sy + 9);
  ctx.fillStyle = P.scrollAccent;
  ctx.fillText(name, sx + 6, sy + 8);
}

function menuScroll(ctx: CanvasRenderingContext2D, t: number, mode: Mode): { x: number; y: number } {
  const x = IW * 0.5, y = 60, sw = 70, sh = 28;
  const dimmed = mode !== 'thinking';
  if (dimmed) ctx.globalAlpha = 0.5;

  ctx.fillStyle = P.shadow;
  ctx.fillRect(x - sw / 2 + 2, y + 2, sw, sh);
  ctx.fillStyle = P.scrollDark;
  ctx.fillRect(x - sw / 2, y, sw, sh);
  ctx.fillStyle = P.scroll;
  ctx.fillRect(x - sw / 2 + 1, y + 1, sw - 2, sh - 2);

  ctx.fillStyle = P.scrollAccent;
  ctx.fillRect(x - sw / 2 - 3, y - 1, 4, sh + 2);
  ctx.fillRect(x + sw / 2 - 1, y - 1, 4, sh + 2);
  ctx.fillStyle = P.norenLight;
  ctx.fillRect(x - sw / 2 - 2, y, 1, sh);
  ctx.fillRect(x + sw / 2, y, 1, sh);

  ctx.font = '5px monospace';
  const items = ['ラーメン', '味噌', '塩', '醤油'];
  items.forEach((item, i) => {
    const highlight = mode === 'thinking' && Math.floor(t / 400) % 4 === i;
    ctx.fillStyle = highlight ? P.scrollAccent : P.scrollText;
    ctx.fillText(item, x - sw / 2 + 5 + i * 17, y + 16);
  });

  ctx.globalAlpha = 1;
  return { x, y: y + sh / 2 };
}

function prepBoard(ctx: CanvasRenderingContext2D, t: number, mode: Mode): { x: number; y: number } {
  const x = IW * 0.35, y = IH * 0.58;

  ctx.fillStyle = P.shadow;
  ctx.beginPath(); ctx.ellipse(x, y + 8, 18, 3, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = P.boardDark;
  ctx.fillRect(x - 16, y - 6, 32, 12);
  ctx.fillStyle = P.board;
  ctx.fillRect(x - 16, y - 6, 32, 10);
  ctx.fillStyle = P.woodHighlight;
  ctx.fillRect(x - 15, y - 5, 30, 1);

  // Ingredients
  ctx.fillStyle = P.veggiesDark;
  ctx.fillRect(x - 12, y - 3, 6, 4);
  ctx.fillStyle = P.veggies;
  ctx.fillRect(x - 12, y - 3, 5, 3);

  ctx.fillStyle = '#daa520';
  ctx.fillRect(x - 3, y - 4, 4, 5);
  ctx.fillStyle = P.egg;
  ctx.fillRect(x - 3, y - 4, 3, 4);

  ctx.fillStyle = '#d4c4a0';
  ctx.fillRect(x + 3, y - 3, 10, 4);
  ctx.fillStyle = P.noodles;
  ctx.fillRect(x + 3, y - 3, 9, 3);

  // Knife
  if (mode === 'typing') {
    const chop = Math.floor(t / 80) % 4;
    ctx.fillStyle = P.knifeDark;
    ctx.fillRect(x + 14, y - 8 - chop * 2, 2, 7);
    ctx.fillStyle = P.knife;
    ctx.fillRect(x + 14, y - 8 - chop * 2, 1, 6);
  } else {
    ctx.fillStyle = P.knifeDark;
    ctx.fillRect(x + 14, y - 6, 2, 5);
    ctx.fillStyle = P.knife;
    ctx.fillRect(x + 14, y - 6, 1, 4);
  }

  return { x, y: y + 10 };
}

function potAndFlame(ctx: CanvasRenderingContext2D, t: number, mode: Mode): { x: number; y: number } {
  const x = IW * 0.65, y = IH * 0.42;

  ctx.fillStyle = P.shadow;
  ctx.beginPath(); ctx.ellipse(x, y + 6, 14, 3, 0, 0, Math.PI * 2); ctx.fill();

  // Flames
  const intensity = mode === 'running' ? 1 : 0.4;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < 4; i++) {
      const fh = 3 + Math.sin(t / 60 + i * 1.3 + layer) * 2;
      const colors = [P.flame1, P.flame2, P.flame3];
      ctx.fillStyle = colors[(i + layer) % 3];
      ctx.globalAlpha = intensity * (layer === 0 ? 0.6 : 1);
      ctx.fillRect(x - 7 + i * 4 - layer, y + 2 - fh, 2, fh);
    }
  }
  ctx.globalAlpha = 1;

  // Pot
  ctx.fillStyle = P.potDark;
  ctx.fillRect(x - 11, y - 12, 22, 16);
  ctx.fillStyle = P.pot;
  ctx.fillRect(x - 10, y - 11, 20, 14);
  ctx.fillStyle = P.potHighlight;
  ctx.fillRect(x - 9, y - 10, 18, 1);

  // Broth
  ctx.fillStyle = P.brothDark;
  ctx.fillRect(x - 8, y - 9, 16, 10);
  ctx.fillStyle = P.broth;
  ctx.fillRect(x - 8, y - 9, 16, 8);

  // Handles
  ctx.fillStyle = P.potDark;
  ctx.fillRect(x - 13, y - 7, 3, 5);
  ctx.fillRect(x + 10, y - 7, 3, 5);

  // Bubbles
  if (mode === 'running') {
    for (let i = 0; i < 4; i++) {
      const by = y - 7 + Math.sin(t / 100 + i * 1.5) * 2;
      const bx = x - 6 + i * 4;
      const bs = 1 + Math.sin(t / 80 + i) * 0.3;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(bx, by, bs, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Ladle
  ctx.fillStyle = P.potDark;
  ctx.fillRect(x + 6, y - 16, 2, 6);
  ctx.beginPath(); ctx.arc(x + 7, y - 10, 2, 0, Math.PI); ctx.fill();

  return { x, y: y + 10 };
}

function counter(ctx: CanvasRenderingContext2D, t: number): { x: number; y: number } {
  const y = IH * 0.78;

  ctx.fillStyle = P.shadowLight;
  ctx.fillRect(0, y + 2, IW, IH - y);

  ctx.fillStyle = P.counterTop;
  ctx.fillRect(0, y, IW, 3);
  ctx.fillStyle = P.woodHighlight;
  ctx.fillRect(0, y, IW, 1);

  ctx.fillStyle = P.counter;
  ctx.fillRect(0, y + 3, IW, IH - y - 3);
  ctx.fillStyle = P.counterDark;
  for (let i = 0; i < IW; i += 6) {
    ctx.fillRect(i, y + 5, 1, IH - y - 8);
  }

  // Stacked bowls
  ctx.fillStyle = P.bowlShadow;
  ctx.beginPath(); ctx.ellipse(IW * 0.2, y - 2, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === 2 ? P.bowl : P.bowlShadow;
    ctx.beginPath(); ctx.ellipse(IW * 0.2, y - 3 - i * 2, 5 - i, 1.5, 0, 0, Math.PI); ctx.fill();
  }

  // Chopsticks jar
  ctx.fillStyle = P.woodDark;
  ctx.fillRect(IW * 0.8 - 4, y - 10, 8, 10);
  ctx.fillStyle = P.wood;
  ctx.fillRect(IW * 0.8 - 3, y - 9, 6, 8);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(IW * 0.8 - 2 + i * 2, y - 13, 1, 5);
  }

  return { x: IW * 0.5, y: y - 4 };
}

function steam(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, intensity: number): void {
  for (let i = 0; i < 6; i++) {
    const age = (t / 30 + i * 10) % 30;
    const sy = y - age;
    const sx = x + Math.sin(t / 140 + i * 0.8) * 3;
    const alpha = Math.max(0, (0.4 - age / 75) * intensity);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath(); ctx.arc(sx, sy, 1.5 + age / 15, 0, Math.PI * 2); ctx.fill();
  }
}

function servingBowl(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  ctx.fillStyle = P.shadow;
  ctx.beginPath(); ctx.ellipse(x, y + 3, 10, 3, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = P.bowlShadow;
  ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = P.bowl;
  ctx.beginPath(); ctx.ellipse(x, y - 1, 9, 3, 0, 0, Math.PI); ctx.fill();

  ctx.fillStyle = P.brothDark;
  ctx.beginPath(); ctx.ellipse(x, y - 2, 8, 2.5, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = P.broth;
  ctx.beginPath(); ctx.ellipse(x, y - 2, 7, 2, 0, 0, Math.PI); ctx.fill();

  ctx.fillStyle = P.noodles;
  for (let i = 0; i < 3; i++) ctx.fillRect(x - 5 + i * 4, y - 3, 2, 1);
  ctx.fillStyle = P.eggDark;
  ctx.beginPath(); ctx.arc(x + 3, y - 3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.egg;
  ctx.beginPath(); ctx.arc(x + 3, y - 3, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.nori;
  ctx.fillRect(x - 6, y - 5, 3, 4);

  for (let i = 0; i < 4; i++) {
    const age = (t / 35 + i * 12) % 20;
    const sy = y - 6 - age;
    const sx = x - 3 + i * 2 + Math.sin(t / 150 + i) * 2;
    ctx.fillStyle = `rgba(255,255,255,${0.5 - age / 40})`;
    ctx.beginPath(); ctx.arc(sx, sy, 1.5 + age / 10, 0, Math.PI * 2); ctx.fill();
  }
}

function ninjaCook(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, mode: Mode): void {
  const anim = Math.floor(t / 180) % 4;
  let bob = 0, arm = 0, walking = false;

  const dx = tx - mx, dy = ty - my, dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 2) { walking = true; bob = Math.sin(t / 70) * 1.5; }

  if (!walking) {
    if (mode === 'typing') { arm = anim % 2 ? -2 : 0; bob = anim % 2 ? -0.5 : 0; }
    else if (mode === 'running') { arm = Math.sin(t / 200) * 2; }
    else if (mode === 'thinking') { arm = -1; }
    else if (mode === 'celebrate') { bob = -anim * 0.5; arm = -1.5; }
    else if (mode === 'error') { bob = anim % 2 * 1.5; }
  }

  const by = y + bob;

  // Shadow
  ctx.fillStyle = P.shadow;
  ctx.beginPath(); ctx.ellipse(x, y + 1, 6, 2, 0, 0, Math.PI * 2); ctx.fill();

  // Legs
  ctx.fillStyle = P.outfitDark;
  if (walking) {
    const legAnim = Math.sin(t / 70) * 2;
    ctx.fillRect(x - 2, by - 6 + legAnim, 2, 5);
    ctx.fillRect(x, by - 6 - legAnim, 2, 5);
  } else {
    ctx.fillRect(x - 2, by - 6, 2, 5);
    ctx.fillRect(x, by - 6, 2, 5);
  }

  // Body
  ctx.fillStyle = P.outfitDark;
  ctx.fillRect(x - 3, by - 13, 7, 8);
  ctx.fillStyle = P.outfit;
  ctx.fillRect(x - 3, by - 13, 6, 7);

  // Apron
  ctx.fillStyle = P.apronShadow;
  ctx.fillRect(x - 2, by - 11, 5, 7);
  ctx.fillStyle = P.apron;
  ctx.fillRect(x - 2, by - 11, 4, 6);

  // Arms
  ctx.fillStyle = P.outfitDark;
  ctx.fillRect(x - 5, by - 12 + arm, 2, 6);
  ctx.fillRect(x + 3, by - 12 + (mode === 'thinking' ? 0 : arm), 2, 6);

  // Hands
  ctx.fillStyle = P.skinDark;
  ctx.fillRect(x - 5, by - 6 + arm, 2, 2);
  ctx.fillRect(x + 3, by - 6 + (mode === 'thinking' ? -3 : arm), 2, 2);

  // Head
  ctx.fillStyle = P.skinDark;
  ctx.fillRect(x - 3, by - 19, 6, 6);
  ctx.fillStyle = P.skin;
  ctx.fillRect(x - 3, by - 19, 5, 5);

  // Hair
  ctx.fillStyle = P.hair;
  ctx.fillRect(x - 3, by - 21, 6, 3);

  // Headband
  ctx.fillStyle = P.headband;
  ctx.fillRect(x - 4, by - 19, 8, 2);
  ctx.fillStyle = P.headbandLight;
  ctx.fillRect(x - 3, by - 19, 6, 1);
  ctx.fillStyle = P.headband;
  ctx.fillRect(x + 3, by - 18, 4, 1);
  ctx.fillRect(x + 5, by - 17, 3, 1);

  // Eyes
  ctx.fillStyle = '#1a1a2e';
  if (Math.floor(t / 2000) % 6 !== 0) {
    ctx.fillRect(x - 2, by - 17, 1, 1);
    ctx.fillRect(x + 1, by - 17, 1, 1);
  }

  // Mode effects
  if (mode === 'error' && !walking) {
    ctx.fillStyle = '#90cdf4';
    ctx.fillRect(x + 4, by - 18, 1, 2);
    ctx.fillRect(x + 4, by - 16, 2, 1);
  }

  if (mode === 'celebrate' && !walking) {
    servingBowl(ctx, x, by - 6, t);
  }

  if (mode === 'thinking' && !walking) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(x + 10, by - 26, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 6, by - 21, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, by - 19, 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.scrollAccent;
    ctx.font = 'bold 5px monospace';
    ctx.fillText('?', x + 8, by - 24);
  }
}

function drawLighting(ctx: CanvasRenderingContext2D, mode: Mode): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, IW, IH);

  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(IW * 0.5, IH * 0.5, 10, IW * 0.5, IH * 0.5, 100);
  g.addColorStop(0, 'rgba(255,200,140,0.35)');
  g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, IW, IH);

  if (mode !== 'thinking') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 55, IW, 40);
  }
  ctx.restore();
}

function vignette(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(IW / 2, IH / 2, IH * 0.2, IW / 2, IH / 2, IH * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, IW, IH);
}

function foreground(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.save();

  // Noren fringe at top
  ctx.globalAlpha = 0.3;
  const count = 9;
  for (let i = 0; i < count; i++) {
    const x = i * (IW / (count - 1));
    const sway = Math.sin(t / 500 + i * 0.5) * 1;
    const h = 4 + i % 3 * 2;
    ctx.fillStyle = P.norenDark;
    ctx.fillRect(x - 2 + sway * 0.3, -1, 3, h + 1);
    ctx.fillStyle = P.noren;
    ctx.fillRect(x - 1 + sway * 0.3, 0, 2, h);
  }

  ctx.globalAlpha = 1;

  // Left edge - hint of adjacent stall/alley (darker, out of focus)
  ctx.fillStyle = 'rgba(10,15,25,0.7)';
  ctx.fillRect(0, IH * 0.3, 8, IH * 0.7);

  // Left stall post
  ctx.fillStyle = '#2a1f15';
  ctx.fillRect(0, IH * 0.35, 5, IH * 0.5);

  // Left distant lantern glow
  const leftGlow = 0.15 + Math.sin(t / 600) * 0.05;
  ctx.fillStyle = `rgba(255,150,80,${leftGlow})`;
  ctx.beginPath();
  ctx.arc(-5, IH * 0.45, 15, 0, Math.PI * 2);
  ctx.fill();

  // Right edge - hint of adjacent stall/alley
  ctx.fillStyle = 'rgba(10,15,25,0.6)';
  ctx.fillRect(IW - 10, IH * 0.32, 10, IH * 0.68);

  // Right stall post
  ctx.fillStyle = '#2a1f15';
  ctx.fillRect(IW - 6, IH * 0.38, 6, IH * 0.47);

  // Right noren hint
  ctx.fillStyle = 'rgba(139,0,0,0.4)';
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(t / 700 + i) * 0.5;
    ctx.fillRect(IW - 5 + sway, IH * 0.38 + i * 8, 4, 6);
  }

  // Right distant lantern glow
  const rightGlow = 0.12 + Math.sin(t / 500 + 2) * 0.04;
  ctx.fillStyle = `rgba(255,130,70,${rightGlow})`;
  ctx.beginPath();
  ctx.arc(IW + 8, IH * 0.5, 18, 0, Math.PI * 2);
  ctx.fill();

  // Ground reflection hints (wet street effect)
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 5; i++) {
    const rx = 20 + i * 35;
    const ry = IH * 0.82 + (i % 2) * 5;
    const rw = 15 + (i % 3) * 8;
    ctx.fillStyle = P.lanternGlow;
    ctx.fillRect(rx, ry, rw, 2);
  }

  ctx.restore();
}

function drawStatus(ctx: CanvasRenderingContext2D, mode: Mode): void {
  const x = 4, y = IH - 14, w = 45, h = 10;

  ctx.fillStyle = 'rgba(6,21,34,0.85)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);

  ctx.fillStyle = MODE_COLORS[mode];
  ctx.fillRect(x + 2, y + 3, 3, 3);

  ctx.fillStyle = '#f2c14e';
  ctx.font = '5px monospace';
  const names: Record<Mode, string> = { idle: 'IDLE', typing: 'PREP', running: 'COOK', thinking: 'READ', celebrate: 'DONE', error: 'OOPS' };
  ctx.fillText(names[mode], x + 8, y + 7);
}
