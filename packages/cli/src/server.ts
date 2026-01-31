import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import type { Mode, StateMessage, HelloMessage, HookEvent } from './types.js';
import { StateMachine } from './stateMachine.js';

interface ServerConfig {
  httpPort: number;
  wsPort: number;
  token: string;
  localIP: string;
  companyName: string;
}

export function createServers(config: ServerConfig, stateMachine: StateMachine) {
  const { httpPort, wsPort, token, localIP, companyName } = config;
  const clients = new Set<WebSocket>();

  stateMachine.onChange((message) => {
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === '/favicon.ico') {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='18' r='12' fill='%23fff'/><ellipse cx='16' cy='14' rx='10' ry='4' fill='%23f4a460'/><path d='M8 13c2 4 4 6 8 6s6-2 8-6' stroke='%23f5deb3' stroke-width='2' fill='none'/><circle cx='20' cy='12' r='3' fill='%23ffd700'/><rect x='6' y='6' rx='1' width='3' height='10' fill='%238b5a2b'/><rect x='23' y='6' rx='1' width='3' height='10' fill='%238b5a2b'/></svg>`;
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(svg);
      return;
    }

    if (url.pathname === '/manifest.json') {
      const manifest = {
        name: companyName,
        short_name: companyName,
        start_url: '/',
        display: 'standalone',
        background_color: '#0d1b2a',
        theme_color: '#0d1b2a',
        orientation: 'any',
        icons: [
          { src: '/favicon.ico', sizes: '32x32', type: 'image/svg+xml' },
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(manifest));
      return;
    }

    if (url.pathname === '/icon-192.svg' || url.pathname === '/icon-512.svg') {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' fill='#0d1b2a'/><circle cx='256' cy='288' r='150' fill='#fff'/><ellipse cx='256' cy='224' rx='125' ry='50' fill='#f4a460'/><path d='M128 208c32 64 64 96 128 96s96-32 128-96' stroke='#f5deb3' stroke-width='24' fill='none'/><circle cx='320' cy='192' r='40' fill='#ffd700'/><rect x='80' y='96' rx='8' width='40' height='160' fill='#8b5a2b'/><rect x='392' y='96' rx='8' width='40' height='160' fill='#8b5a2b'/></svg>`;
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(svg);
      return;
    }

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getPWAHTML(localIP, wsPort, token, companyName));
      return;
    }

    if (url.pathname === '/pair') {
      const urlToken = url.searchParams.get('token');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getPairPageHTML(localIP, wsPort, token, urlToken === token, companyName));
      return;
    }

    if (url.pathname === '/hook' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const event: HookEvent = JSON.parse(body);
          handleHookEvent(event, stateMachine);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (url.pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ mode: stateMachine.mode, ts: Date.now() }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  const wss = new WebSocketServer({ port: wsPort });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `ws://${req.headers.host}`);
    const urlToken = url.searchParams.get('token');

    if (urlToken !== token) {
      ws.close(4001, 'Invalid token');
      return;
    }

    clients.add(ws);

    const stateMessage: StateMessage = {
      type: 'state',
      mode: stateMachine.mode,
      ts: Date.now(),
    };
    ws.send(JSON.stringify(stateMessage));

    ws.on('message', (data) => {
      try {
        const message: HelloMessage = JSON.parse(data.toString());
        if (message.type === 'hello') {
          console.log(`Client connected: ${message.client} v${message.version}`);
        }
      } catch (err) {}
    });

    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  return {
    httpServer,
    wss,
    start: () => httpServer.listen(httpPort),
    getClientCount: () => clients.size,
  };
}

function handleHookEvent(event: HookEvent, stateMachine: StateMachine): void {
  console.log(`[HOOK] ${event.type} tool=${event.tool || 'none'}`);
  if (event.type === 'PreToolUse') {
    const tool = event.tool || '';
    // Prep (typing) - writing/editing code
    if (['Write', 'Edit', 'NotebookEdit'].includes(tool)) {
      stateMachine.emit('typing', 5000);
    }
    // Cook (running) - executing commands
    else if (tool === 'Bash') {
      stateMachine.emit('running', 10000);
    }
    // Think (thinking) - reading/searching/researching
    else if (['Read', 'Grep', 'Glob', 'Task', 'WebFetch', 'WebSearch'].includes(tool)) {
      stateMachine.emit('thinking', 3000);
    }
  } else if (event.type === 'Stop') {
    stateMachine.emit('celebrate', 2000);
  } else if (event.type === 'Error' || (event.exitCode && event.exitCode !== 0)) {
    stateMachine.emit('error', 2000);
  }
}

function getPWAHTML(ip: string, wsPort: number, token: string, companyName: string): string {
  const wsEndpoint = `ws://${ip}:${wsPort}/ws?token=${token}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <meta name="theme-color" content="#0d1b2a">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>${companyName}</title>
  <link rel="icon" href="/favicon.ico">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icon-192.svg">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--sat:env(safe-area-inset-top);--sar:env(safe-area-inset-right);--sab:env(safe-area-inset-bottom);--sal:env(safe-area-inset-left)}
    html,body{margin:0;height:100%;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;background:#040d14;background-image:radial-gradient(ellipse at 50% 60%,#0a1628 0%,#040d14 70%),repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.01) 2px,rgba(255,255,255,0.01) 4px)}
    #c{image-rendering:pixelated;image-rendering:crisp-edges;position:absolute;top:0;left:0}
  </style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(()=>{
const WS='${wsEndpoint}',CO='${companyName}',TK='${token}';
const cv=document.getElementById('c'),cx=cv.getContext('2d');
// Portrait-first resolution (180 wide x 320 tall)
const IW=180,IH=320;
let scale=2,mode='idle',ws,rd=1e3;

function resize(){
  const dpr=devicePixelRatio||1;
  const vp=window.visualViewport;
  const rawW=Math.floor((vp&&vp.width)||innerWidth);
  const rawH=Math.floor((vp&&vp.height)||innerHeight);

  // Safe-area insets
  const cs=getComputedStyle(document.documentElement);
  const insetT=parseFloat(cs.getPropertyValue('--sat'))||0;
  const insetB=parseFloat(cs.getPropertyValue('--sab'))||0;
  const insetL=parseFloat(cs.getPropertyValue('--sal'))||0;
  const insetR=parseFloat(cs.getPropertyValue('--sar'))||0;

  const vw=Math.max(1,Math.floor(rawW-insetL-insetR));
  const vh=Math.max(1,Math.floor(rawH-insetT-insetB));

  // Integer scale that fits 180x320 in viewport
  scale=Math.max(1,Math.floor(Math.min(vw/IW,vh/IH)));

  const cssW=IW*scale,cssH=IH*scale;
  cv.style.width=cssW+'px';
  cv.style.height=cssH+'px';
  cv.style.left=Math.floor(insetL+(vw-cssW)/2)+'px';
  cv.style.top=Math.floor(insetT+(vh-cssH)/2)+'px';

  cv.width=Math.floor(cssW*dpr);
  cv.height=Math.floor(cssH*dpr);
  cx.setTransform(1,0,0,1,0,0);
  cx.imageSmoothingEnabled=false;
  cx.scale(dpr*scale,dpr*scale);
}
resize();
addEventListener('resize',resize);
if(window.visualViewport){
  visualViewport.addEventListener('resize',resize);
  visualViewport.addEventListener('scroll',resize);
}
addEventListener('orientationchange',()=>setTimeout(resize,150));

// Ramen stall color palette
const P={
  // Night sky
  sky:'#0a1628',skyMid:'#152238',skyLight:'#1e3a5f',
  // Lanterns
  lanternGlow:'#ff6b35',lanternBody:'#c1121f',lanternLight:'#ffd166',lanternDark:'#8b0000',
  // Wood/stall
  wood:'#8b5a2b',woodLight:'#a67c52',woodDark:'#5d3a1a',woodHighlight:'#c4956a',
  counter:'#6d4c41',counterTop:'#8b7355',counterDark:'#4a3728',
  // Pot & flame
  pot:'#3d4f5f',potDark:'#2d3a47',potHighlight:'#5a6f7f',
  flame1:'#ff6b35',flame2:'#ffd166',flame3:'#ff8c42',broth:'#d4a574',brothDark:'#b8956a',
  // Scroll
  scroll:'#f5f0e1',scrollDark:'#e8dcc8',scrollText:'#2d3748',scrollAccent:'#c1121f',
  // Prep
  board:'#deb887',boardDark:'#c9a66b',knife:'#d0d0d0',knifeDark:'#a0a0a0',
  noodles:'#f5deb3',veggies:'#68d391',veggiesDark:'#48bb78',
  // Bowl
  bowl:'#fff',bowlShadow:'#ddd',ramen:'#f4a460',egg:'#ffd700',eggDark:'#daa520',nori:'#2d5016',
  // Noren
  noren:'#c1121f',norenDark:'#8b0000',norenLight:'#e63946',
  // Character
  skin:'#ffd9b3',skinDark:'#e6c49f',hair:'#1a1a2e',headband:'#c1121f',headbandLight:'#e63946',
  outfit:'#2d3748',outfitDark:'#1a202c',apron:'#fff',apronShadow:'#ddd',
  // Shadow
  shadow:'rgba(0,0,0,0.3)',shadowLight:'rgba(0,0,0,0.15)'
};

// Character position (centered horizontally, middle vertically)
let mx=IW*0.5,my=IH*0.5,tx=mx,ty=my;

function connect(){
  ws=new WebSocket(WS);
  ws.onopen=()=>{rd=1e3;ws.send(JSON.stringify({type:'hello',version:1,client:'pwa',token:TK}))};
  ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='state')mode=m.mode}catch(e){}};
  ws.onclose=()=>{setTimeout(connect,rd);rd=Math.min(rd*1.5,3e4)};
  ws.onerror=()=>ws.close();
}

// Night sky with gradient and stars (vertical layout)
function nightSky(t){
  // Gradient from top to bottom
  const g=cx.createLinearGradient(0,0,0,IH);
  g.addColorStop(0,P.sky);
  g.addColorStop(0.3,P.skyMid);
  g.addColorStop(0.6,P.skyLight);
  g.addColorStop(1,'#1a202c');
  cx.fillStyle=g;
  cx.fillRect(0,0,IW,IH);

  // Twinkling stars in upper portion
  for(let i=0;i<25;i++){
    const twinkle=Math.sin(t/400+i*37)>0.5;
    const brightness=0.4+Math.sin(t/300+i*23)*0.3;
    if(twinkle){
      cx.fillStyle='rgba(255,255,255,'+brightness+')';
      const sx=(i*31+7)%IW,sy=2+(i*11)%60;
      const sz=i%5===0?2:1;
      cx.fillRect(sx,sy,sz,sz);
    }
  }

  // Distant roof/mountain silhouettes (very subtle)
  cx.fillStyle='rgba(0,0,0,0.18)';
  cx.beginPath();
  cx.moveTo(0,78);
  cx.lineTo(18,70);
  cx.lineTo(34,76);
  cx.lineTo(52,68);
  cx.lineTo(72,74);
  cx.lineTo(92,66);
  cx.lineTo(112,74);
  cx.lineTo(132,68);
  cx.lineTo(150,76);
  cx.lineTo(IW,72);
  cx.lineTo(IW,92);
  cx.lineTo(0,92);
  cx.closePath();
  cx.fill();
}

// Interior framing + floor so it feels like a real ramen stall
function shopFrame(t){
  // Side wooden posts (frame the stall)
  cx.fillStyle=P.woodDark;
  cx.fillRect(0,0,8,IH);
  cx.fillRect(IW-8,0,8,IH);
  cx.fillStyle=P.wood;
  cx.fillRect(7,0,1,IH);
  cx.fillRect(IW-8,0,1,IH);

  // Top beam (behind sign/lanterns)
  cx.fillStyle=P.woodDark;
  cx.fillRect(0,18,IW,4);
  cx.fillStyle=P.woodHighlight;
  cx.fillRect(0,18,IW,1);

  // Back wall panel behind the action area (subtle)
  cx.fillStyle='rgba(0,0,0,0.10)';
  cx.fillRect(8,90,IW-16,58);

  // Floor band between mid area and counter (gives grounding)
  const fy=Math.floor(IH*0.50);
  const fh=Math.floor(IH*0.24);
  cx.fillStyle='rgba(15,28,45,0.30)';
  cx.fillRect(0,fy,IW,fh);
  cx.fillStyle='rgba(255,255,255,0.025)';
  for(let yy=fy;yy<fy+fh;yy+=6){ cx.fillRect(0,yy,IW,1); }

  // Hanging ticket rail above the counter (very ramen-shop)
  const ry=Math.floor(IH*0.70);
  cx.fillStyle=P.woodDark;
  cx.fillRect(12,ry,IW-24,2);
  for(let i=0;i<6;i++){
    const tickX=16+i*24+(i%2?2:0);
    const sway=Math.sin(t/650+i*1.3)*1.0;
    cx.fillStyle=P.scrollDark;
    cx.fillRect(tickX+sway,ry+2,10,12);
    cx.fillStyle=P.scroll;
    cx.fillRect(tickX+sway,ry+2,9,11);
    cx.fillStyle=P.scrollAccent;
    cx.fillRect(tickX+sway+1,ry+4,5,1);
    cx.fillRect(tickX+sway+1,ry+7,4,1);
  }
}

// Lanterns at top (horizontal row for 180px width)
// Lanterns at top (two rows for 180px width)
function lanterns(t){
  const rows=[
    { y:6,  scale:1.0, alpha:1.0 },
    { y:24, scale:0.72, alpha:0.75 },
  ];
  const row1=[IW*0.12,IW*0.38,IW*0.62,IW*0.88];
  const row2=[IW*0.22,IW*0.50,IW*0.78];

  rows.forEach((r,ri)=>{
    const positions=ri===0?row1:row2;
    positions.forEach((lx,i)=>{
      const sway=Math.sin(t/850+(i+ri)*1.45)*1.2;
      const ly=r.y+(i%2)*3;
      const size=r.scale*(i===1?1.05:1);

      // String
      cx.strokeStyle=P.woodDark;cx.lineWidth=1;
      cx.beginPath();cx.moveTo(lx,0);cx.lineTo(lx+sway,ly);cx.stroke();

      // Glow (warmer + pulsing)
      const pulse=0.14+Math.sin(t/160+(i+ri)*1.9)*0.07;
      cx.fillStyle='rgba(255,107,53,'+(pulse*0.55*r.alpha)+')';
      cx.beginPath();cx.arc(lx+sway,ly+7*size,16*size,0,Math.PI*2);cx.fill();
      cx.fillStyle='rgba(255,211,102,'+(pulse*1.0*r.alpha)+')';
      cx.beginPath();cx.arc(lx+sway,ly+7*size,9*size,0,Math.PI*2);cx.fill();

      // Lantern body
      const lw=9*size,lh=13*size;
      cx.fillStyle=P.lanternDark;
      cx.fillRect(lx+sway-lw/2,ly,lw,lh);
      cx.fillStyle=P.lanternBody;
      cx.fillRect(lx+sway-lw/2+1,ly,lw-2,lh);

      // Inner light band
      cx.fillStyle=P.lanternLight;
      cx.globalAlpha=(0.32+Math.sin(t/140+i+ri)*0.18)*r.alpha;
      cx.fillRect(lx+sway-lw/2+2,ly+2,lw-4,lh-4);
      cx.globalAlpha=1;

      // Caps
      cx.fillStyle=P.woodDark;
      cx.fillRect(lx+sway-lw/2-1,ly-1,lw+2,2);
      cx.fillRect(lx+sway-lw/2-1,ly+lh-1,lw+2,2);

      // Small tassel (ramen-stall vibe)
      cx.fillStyle=P.norenDark;
      cx.fillRect(lx+sway-0.5,ly+lh,1,3);
      cx.fillStyle=P.noren;
      cx.fillRect(lx+sway-0.5,ly+lh+2,1,2);
    });
  });
}

// Noren under sign (vertical layout)
function norenSign(t){
  const y=38,norenW=10,gap=2;
  const count=7;
  const totalW=count*norenW+(count-1)*gap;
  const startX=IW/2-totalW/2;

  for(let i=0;i<count;i++){
    const nx=startX+i*(norenW+gap)+norenW/2;
    const sway=Math.sin(t/600+i*0.8)*0.8;
    const h=14+i%2*2;

    // Shadow
    cx.fillStyle=P.norenDark;
    cx.beginPath();
    cx.moveTo(nx-norenW/2+1,y);
    cx.lineTo(nx-norenW/2+2+sway,y+h);
    cx.lineTo(nx+norenW/2+sway,y+h);
    cx.lineTo(nx+norenW/2-1,y);
    cx.fill();

    // Main curtain
    cx.fillStyle=P.noren;
    cx.beginPath();
    cx.moveTo(nx-norenW/2,y);
    cx.lineTo(nx-norenW/2+1+sway,y+h-1);
    cx.lineTo(nx+norenW/2-1+sway,y+h-1);
    cx.lineTo(nx+norenW/2,y);
    cx.fill();

    // Highlight
    cx.fillStyle=P.norenLight;
    cx.fillRect(nx-norenW/2+1,y+1,2,h/2);
  }

  // Bar
  cx.fillStyle=P.woodDark;
  cx.fillRect(startX-3,y-2,totalW+6,3);
}

// Sign at top (vertical layout)
function stallSign(){
  const sw=CO.length*5+12,sx=IW/2-sw/2,sy=22;

  // Drop shadow
  cx.fillStyle=P.shadow;
  cx.fillRect(sx+2,sy+2,sw,14);

  // Wood frame
  cx.fillStyle=P.woodDark;
  cx.fillRect(sx-2,sy-2,sw+4,18);
  cx.fillStyle=P.wood;
  cx.fillRect(sx-1,sy-1,sw+2,16);
  cx.fillStyle=P.woodHighlight;
  cx.fillRect(sx,sy,sw,1);

  // Sign face
  cx.fillStyle=P.scroll;
  cx.fillRect(sx,sy,sw,12);
  cx.fillStyle=P.scrollDark;
  cx.fillRect(sx,sy+10,sw,2);

  // Text
  cx.fillStyle=P.shadowLight;
  cx.font='bold 7px monospace';
  cx.fillText(CO,sx+7,sy+9);
  cx.fillStyle=P.scrollAccent;
  cx.fillText(CO,sx+6,sy+8);

  // Vertical ramen banner (right side)
  const bx=IW-14,by=sy+6,bw=9,bh=46;
  cx.fillStyle=P.norenDark;cx.fillRect(bx+1,by+1,bw,bh);
  cx.fillStyle=P.noren;cx.fillRect(bx,by,bw,bh);
  cx.fillStyle=P.norenLight;cx.fillRect(bx+1,by+1,2,bh-2);

  cx.save();
  cx.translate(bx+6,by+10);
  cx.rotate(-Math.PI/2);
  cx.fillStyle='#fff';
  cx.font='bold 6px monospace';
  cx.fillText(CO,0,0);
  cx.restore();
}

// Menu scroll - thinking station (below sign)
function menuScroll(t){
  const x=IW*0.5,y=60;
  const sw=70,sh=28;

  // Dim when not thinking
  const dimmed=mode!=='thinking';
  if(dimmed)cx.globalAlpha=0.5;

  // Shadow
  cx.fillStyle=P.shadow;
  cx.fillRect(x-sw/2+2,y+2,sw,sh);

  // Scroll background
  cx.fillStyle=P.scrollDark;
  cx.fillRect(x-sw/2,y,sw,sh);
  cx.fillStyle=P.scroll;
  cx.fillRect(x-sw/2+1,y+1,sw-2,sh-2);

  // Scroll ends
  cx.fillStyle=P.scrollAccent;
  cx.fillRect(x-sw/2-3,y-1,4,sh+2);
  cx.fillRect(x+sw/2-1,y-1,4,sh+2);
  cx.fillStyle=P.norenLight;
  cx.fillRect(x-sw/2-2,y,1,sh);
  cx.fillRect(x+sw/2,y,1,sh);

  // Menu text (horizontal layout)
  cx.font='5px monospace';
  const items=['ラーメン','味噌','塩','醤油'];
  items.forEach((item,i)=>{
    const highlight=mode==='thinking'&&Math.floor(t/400)%4===i;
    cx.fillStyle=highlight?P.scrollAccent:P.scrollText;
    cx.fillText(item,x-sw/2+5+i*17,y+16);
  });

  // Small ramen poster under the menu (adds shop ambience)
  const px=x-28,py=y+sh+6,pw=26,ph=18;
  cx.fillStyle=P.shadow;
  cx.fillRect(px+2,py+2,pw,ph);
  cx.fillStyle=P.woodDark;
  cx.fillRect(px-1,py-1,pw+2,ph+2);
  cx.fillStyle=P.scroll;
  cx.fillRect(px,py,pw,ph);
  cx.fillStyle=P.scrollDark;
  cx.fillRect(px,py+ph-3,pw,3);

  // Tiny bowl icon
  cx.fillStyle=P.bowlShadow;
  cx.beginPath();cx.ellipse(px+13,py+11,8,3,0,0,Math.PI);cx.fill();
  cx.fillStyle=P.bowl;
  cx.beginPath();cx.ellipse(px+13,py+10,7,2.5,0,0,Math.PI);cx.fill();
  cx.fillStyle=P.ramen;
  cx.beginPath();cx.ellipse(px+13,py+9,6,2,0,0,Math.PI);cx.fill();

  // Steam lines
  cx.fillStyle='rgba(255,255,255,0.55)';
  cx.fillRect(px+9,py+3,1,3);
  cx.fillRect(px+13,py+2,1,4);
  cx.fillRect(px+17,py+3,1,3);

  cx.globalAlpha=1;
  return {x,y:y+sh/2};
}

// Prep board - typing station (lower middle, slightly left)
function prepBoard(t){
  const x=IW*0.35,y=IH*0.58;

  // Shadow
  cx.fillStyle=P.shadow;
  cx.beginPath();cx.ellipse(x,y+8,18,3,0,0,Math.PI*2);cx.fill();

  // Board
  cx.fillStyle=P.boardDark;
  cx.fillRect(x-16,y-6,32,12);
  cx.fillStyle=P.board;
  cx.fillRect(x-16,y-6,32,10);
  cx.fillStyle=P.woodHighlight;
  cx.fillRect(x-15,y-5,30,1);

  // Ingredients
  cx.fillStyle=P.veggiesDark;
  cx.fillRect(x-12,y-3,6,4);
  cx.fillStyle=P.veggies;
  cx.fillRect(x-12,y-3,5,3);

  cx.fillStyle='#daa520';
  cx.fillRect(x-3,y-4,4,5);
  cx.fillStyle=P.egg;
  cx.fillRect(x-3,y-4,3,4);

  cx.fillStyle='#d4c4a0';
  cx.fillRect(x+3,y-3,10,4);
  cx.fillStyle=P.noodles;
  cx.fillRect(x+3,y-3,9,3);

  // Knife
  if(mode==='typing'){
    const chop=Math.floor(t/80)%4;
    cx.fillStyle=P.knifeDark;
    cx.fillRect(x+14,y-8-chop*2,2,7);
    cx.fillStyle=P.knife;
    cx.fillRect(x+14,y-8-chop*2,1,6);
  }else{
    cx.fillStyle=P.knifeDark;
    cx.fillRect(x+14,y-6,2,5);
    cx.fillStyle=P.knife;
    cx.fillRect(x+14,y-6,1,4);
  }

  return {x,y:y+10};
}

// Pot and flame - cook station (center, slightly right)
function potAndFlame(t){
  const x=IW*0.65,y=IH*0.42;

  // Shadow
  cx.fillStyle=P.shadow;
  cx.beginPath();cx.ellipse(x,y+6,14,3,0,0,Math.PI*2);cx.fill();

  // Flames
  const intensity=mode==='running'?1:0.4;
  for(let layer=0;layer<2;layer++){
    for(let i=0;i<4;i++){
      const fh=3+Math.sin(t/60+i*1.3+layer)*2;
      const colors=[P.flame1,P.flame2,P.flame3];
      cx.fillStyle=colors[(i+layer)%3];
      cx.globalAlpha=intensity*(layer===0?0.6:1);
      cx.fillRect(x-7+i*4-layer,y+2-fh,2,fh);
    }
  }
  cx.globalAlpha=1;

  // Pot
  cx.fillStyle=P.potDark;
  cx.fillRect(x-11,y-12,22,16);
  cx.fillStyle=P.pot;
  cx.fillRect(x-10,y-11,20,14);
  cx.fillStyle=P.potHighlight;
  cx.fillRect(x-9,y-10,18,1);

  // Broth
  cx.fillStyle=P.brothDark;
  cx.fillRect(x-8,y-9,16,10);
  cx.fillStyle=P.broth;
  cx.fillRect(x-8,y-9,16,8);

  // Handles
  cx.fillStyle=P.potDark;
  cx.fillRect(x-13,y-7,3,5);
  cx.fillRect(x+10,y-7,3,5);

  // Bubbles
  if(mode==='running'){
    for(let i=0;i<4;i++){
      const by=y-7+Math.sin(t/100+i*1.5)*2;
      const bx=x-6+i*4;
      const bs=1+Math.sin(t/80+i)*0.3;
      cx.fillStyle='rgba(255,255,255,0.7)';
      cx.beginPath();cx.arc(bx,by,bs,0,Math.PI*2);cx.fill();
    }
  }

  // Ladle
  cx.fillStyle=P.potDark;
  cx.fillRect(x+6,y-16,2,6);
  cx.beginPath();cx.arc(x+7,y-10,2,0,Math.PI);cx.fill();

  return {x,y:y+10};
}

// Counter - serve station at bottom
function counter(t){
  const y=IH*0.78;

  // Counter shadow
  cx.fillStyle=P.shadowLight;
  cx.fillRect(0,y+2,IW,IH-y);

  // Counter top
  cx.fillStyle=P.counterTop;
  cx.fillRect(0,y,IW,3);
  cx.fillStyle=P.woodHighlight;
  cx.fillRect(0,y,IW,1);

  // Counter front
  cx.fillStyle=P.counter;
  cx.fillRect(0,y+3,IW,IH-y-3);
  cx.fillStyle=P.counterDark;
  for(let i=0;i<IW;i+=6){
    cx.fillRect(i,y+5,1,IH-y-8);
  }

  // Props
  // Stacked bowls (left)
  cx.fillStyle=P.bowlShadow;
  cx.beginPath();cx.ellipse(IW*0.2,y-2,6,2,0,0,Math.PI*2);cx.fill();
  for(let i=0;i<3;i++){
    cx.fillStyle=i===2?P.bowl:P.bowlShadow;
    cx.beginPath();cx.ellipse(IW*0.2,y-3-i*2,5-i,1.5,0,0,Math.PI);cx.fill();
  }

  // Chopsticks jar (right)
  cx.fillStyle=P.woodDark;
  cx.fillRect(IW*0.8-4,y-10,8,10);
  cx.fillStyle=P.wood;
  cx.fillRect(IW*0.8-3,y-9,6,8);
  for(let i=0;i<3;i++){
    cx.fillStyle='#d4a574';
    cx.fillRect(IW*0.8-2+i*2,y-13,1,5);
  }

  // Soy sauce (center-left)
  cx.fillStyle=P.potDark;
  cx.fillRect(IW*0.4,y-8,5,8);
  cx.fillStyle=P.pot;
  cx.fillRect(IW*0.4+1,y-7,3,6);
  cx.fillStyle='#c1121f';
  cx.fillRect(IW*0.4+1,y-10,3,3);

  // Chili oil jar (next to soy)
  cx.fillStyle=P.norenDark;
  cx.fillRect(IW*0.45,y-8,5,8);
  cx.fillStyle=P.noren;
  cx.fillRect(IW*0.45+1,y-7,3,6);
  cx.fillStyle=P.lanternLight;
  cx.fillRect(IW*0.45+1,y-10,3,3);

  // Ticket stack (ramen shop order tickets)
  cx.fillStyle=P.scrollDark;
  cx.fillRect(IW*0.62,y-9,8,7);
  cx.fillStyle=P.scroll;
  cx.fillRect(IW*0.62,y-9,7,6);
  cx.fillStyle=P.scrollAccent;
  cx.fillRect(IW*0.62+1,y-8,5,1);
  cx.fillRect(IW*0.62+1,y-6,4,1);

  // Napkin box (center-right)
  cx.fillStyle=P.scrollDark;
  cx.fillRect(IW*0.55,y-5,10,5);
  cx.fillStyle=P.scroll;
  cx.fillRect(IW*0.55,y-5,9,4);

  // Foreground stools (customer seating) - partially visible at bottom
  for(let i=0;i<3;i++){
    const sx=IW*0.22+i*IW*0.28;
    const sy=IH-10;
    // shadow
    cx.fillStyle=P.shadowLight;
    cx.beginPath();cx.ellipse(sx,sy+6,10,3,0,0,Math.PI*2);cx.fill();
    // seat
    cx.fillStyle=P.woodDark;
    cx.fillRect(sx-7,sy,14,4);
    cx.fillStyle=P.wood;
    cx.fillRect(sx-6,sy+1,12,3);
    // legs
    cx.fillStyle=P.woodDark;
    cx.fillRect(sx-6,sy+4,2,6);
    cx.fillRect(sx+4,sy+4,2,6);
  }

  return {x:IW*0.5,y:y-4};
}

// Serving bowl with steam
function servingBowl(x,y,t){
  // Bowl shadow
  cx.fillStyle=P.shadow;
  cx.beginPath();cx.ellipse(x,y+3,10,3,0,0,Math.PI*2);cx.fill();

  // Bowl
  cx.fillStyle=P.bowlShadow;
  cx.beginPath();cx.ellipse(x,y,10,4,0,0,Math.PI);cx.fill();
  cx.fillStyle=P.bowl;
  cx.beginPath();cx.ellipse(x,y-1,9,3,0,0,Math.PI);cx.fill();

  // Broth
  cx.fillStyle=P.brothDark;
  cx.beginPath();cx.ellipse(x,y-2,8,2.5,0,0,Math.PI);cx.fill();
  cx.fillStyle=P.broth;
  cx.beginPath();cx.ellipse(x,y-2,7,2,0,0,Math.PI);cx.fill();

  // Toppings
  cx.fillStyle=P.noodles;
  for(let i=0;i<3;i++)cx.fillRect(x-5+i*4,y-3,2,1);
  cx.fillStyle=P.eggDark;
  cx.beginPath();cx.arc(x+3,y-3,2,0,Math.PI*2);cx.fill();
  cx.fillStyle=P.egg;
  cx.beginPath();cx.arc(x+3,y-3,1.5,0,Math.PI*2);cx.fill();
  cx.fillStyle=P.nori;
  cx.fillRect(x-6,y-5,3,4);

  // Steam
  for(let i=0;i<4;i++){
    const age=(t/35+i*12)%20;
    const sy=y-6-age;
    const sx=x-3+i*2+Math.sin(t/150+i)*2;
    cx.fillStyle='rgba(255,255,255,'+(0.5-age/40)+')';
    cx.beginPath();cx.arc(sx,sy,1.5+age/10,0,Math.PI*2);cx.fill();
  }
}

// Steam effect (smaller for portrait)
function steam(t,x,y,intensity=1){
  for(let i=0;i<6;i++){
    const age=(t/30+i*10)%30;
    const sy=y-age;
    const sx=x+Math.sin(t/140+i*0.8)*3;
    const alpha=Math.max(0,(0.4-age/75)*intensity);
    cx.fillStyle='rgba(255,255,255,'+alpha+')';
    cx.beginPath();cx.arc(sx,sy,1.5+age/15,0,Math.PI*2);cx.fill();
  }
}

// Lighting pass for vertical layout
function drawLighting(){
  cx.save();
  // Dim scene slightly
  cx.globalCompositeOperation='multiply';
  cx.fillStyle='rgba(0,0,0,0.15)';
  cx.fillRect(0,0,IW,IH);

  // Warm light in center/work area
  cx.globalCompositeOperation='screen';
  const g=cx.createRadialGradient(IW*0.5,IH*0.5,10,IW*0.5,IH*0.5,100);
  g.addColorStop(0,'rgba(255,200,140,0.35)');
  g.addColorStop(1,'rgba(255,200,140,0)');
  cx.fillStyle=g;
  cx.fillRect(0,0,IW,IH);

  // Dim menu area when not thinking
  if(mode!=='thinking'){
    cx.globalCompositeOperation='multiply';
    cx.fillStyle='rgba(0,0,0,0.2)';
    cx.fillRect(0,55,IW,40);
  }
  cx.restore();
}

// Vignette for vertical layout
function vignette(){
  const g=cx.createRadialGradient(IW/2,IH/2,IH*0.2,IW/2,IH/2,IH*0.6);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(1,'rgba(0,0,0,0.4)');
  cx.fillStyle=g;
  cx.fillRect(0,0,IW,IH);
}

// Foreground layer for vertical layout
function foreground(t){
  cx.save();
  // Noren fringe at top
  cx.globalAlpha=0.3;
  const count=9;
  for(let i=0;i<count;i++){
    const x=i*(IW/(count-1));
    const sway=Math.sin(t/500+i*0.5)*1;
    const h=4+i%3*2;
    cx.fillStyle=P.norenDark;
    cx.fillRect(x-2+sway*0.3,-1,3,h+1);
    cx.fillStyle=P.noren;
    cx.fillRect(x-1+sway*0.3,0,2,h);
  }
  cx.restore();
}

// Pixel panel for UI
function drawPixelPanel(x,y,w,h){
  cx.fillStyle='rgba(6,21,34,0.85)';
  cx.fillRect(x,y,w,h);
  cx.fillStyle='rgba(255,255,255,0.3)';
  cx.fillRect(x,y,w,1);cx.fillRect(x,y+h-1,w,1);
  cx.fillRect(x,y,1,h);cx.fillRect(x+w-1,y,1,h);
}

// Canvas-based status UI (bottom of vertical layout)
function drawStatus(){
  const x=4,y=IH-14,w=45,h=10;
  drawPixelPanel(x,y,w,h);
  // Connection dot
  cx.fillStyle=ws&&ws.readyState===1?'#3ddc84':'#ff5252';
  cx.fillRect(x+2,y+3,3,3);
  // Mode text
  cx.fillStyle='#f2c14e';
  cx.font='5px monospace';
  const names={idle:'IDLE',typing:'PREP',running:'COOK',thinking:'READ',celebrate:'DONE',error:'OOPS'};
  cx.fillText(names[mode]||mode,x+8,y+7);
}

// Ninja cook character with depth
function ninjaCook(x,y,t){
  const anim=Math.floor(t/180)%4;
  let bob=0,arm=0,walking=false;

  const dx=tx-mx,dy=ty-my,dist=Math.sqrt(dx*dx+dy*dy);
  if(dist>2){walking=true;bob=Math.sin(t/70)*1.5;}

  if(!walking){
    if(mode==='typing'){arm=anim%2?-2:0;bob=anim%2?-0.5:0;}
    else if(mode==='running'){arm=Math.sin(t/200)*2;}
    else if(mode==='thinking'){arm=-1;}
    else if(mode==='celebrate'){bob=-anim*0.5;arm=-1.5;}
    else if(mode==='error'){bob=anim%2*1.5;}
  }

  const by=y+bob;

  // Shadow (contact shadow for depth)
  cx.fillStyle=P.shadow;
  cx.beginPath();cx.ellipse(x,y+1,6,2,0,0,Math.PI*2);cx.fill();

  // Legs with shading
  cx.fillStyle=P.outfitDark;
  if(walking){
    const legAnim=Math.sin(t/70)*2;
    cx.fillRect(x-2,by-6+legAnim,2,5);
    cx.fillRect(x,by-6-legAnim,2,5);
  }else{
    cx.fillRect(x-2,by-6,2,5);
    cx.fillRect(x,by-6,2,5);
  }
  cx.fillStyle=P.outfit;
  if(walking){
    const legAnim=Math.sin(t/70)*2;
    cx.fillRect(x-2,by-6+legAnim,1,4);
    cx.fillRect(x,by-6-legAnim,1,4);
  }else{
    cx.fillRect(x-2,by-6,1,4);
    cx.fillRect(x,by-6,1,4);
  }

  // Body with shading
  cx.fillStyle=P.outfitDark;
  cx.fillRect(x-3,by-13,7,8);
  cx.fillStyle=P.outfit;
  cx.fillRect(x-3,by-13,6,7);

  // Apron with shadow
  cx.fillStyle=P.apronShadow;
  cx.fillRect(x-2,by-11,5,7);
  cx.fillStyle=P.apron;
  cx.fillRect(x-2,by-11,4,6);

  // Arms
  cx.fillStyle=P.outfitDark;
  cx.fillRect(x-5,by-12+arm,2,6);
  cx.fillRect(x+3,by-12+(mode==='thinking'?0:arm),2,6);
  cx.fillStyle=P.outfit;
  cx.fillRect(x-5,by-12+arm,1,5);
  cx.fillRect(x+3,by-12+(mode==='thinking'?0:arm),1,5);

  // Hands
  cx.fillStyle=P.skinDark;
  cx.fillRect(x-5,by-6+arm,2,2);
  cx.fillRect(x+3,by-6+(mode==='thinking'?-3:arm),2,2);
  cx.fillStyle=P.skin;
  cx.fillRect(x-5,by-6+arm,1,1);
  cx.fillRect(x+3,by-6+(mode==='thinking'?-3:arm),1,1);

  // Head
  cx.fillStyle=P.skinDark;
  cx.fillRect(x-3,by-19,6,6);
  cx.fillStyle=P.skin;
  cx.fillRect(x-3,by-19,5,5);

  // Hair
  cx.fillStyle=P.hair;
  cx.fillRect(x-3,by-21,6,3);

  // Headband with highlight
  cx.fillStyle=P.headband;
  cx.fillRect(x-4,by-19,8,2);
  cx.fillStyle=P.headbandLight;
  cx.fillRect(x-3,by-19,6,1);
  // Headband tails
  cx.fillStyle=P.headband;
  cx.fillRect(x+3,by-18,4,1);
  cx.fillRect(x+5,by-17,3,1);

  // Eyes
  cx.fillStyle='#1a1a2e';
  if(Math.floor(t/2000)%6!==0){
    cx.fillRect(x-2,by-17,1,1);
    cx.fillRect(x+1,by-17,1,1);
  }

  // Mode-specific effects
  if(mode==='error'&&!walking){
    // Sweat drop
    cx.fillStyle='#90cdf4';
    cx.fillRect(x+4,by-18,1,2);
    cx.fillRect(x+4,by-16,2,1);

    // Dropped chopsticks
    cx.fillStyle=P.wood;
    cx.save();
    cx.translate(x+8,by-4);
    cx.rotate(Math.PI/4+Math.sin(t/40)*0.1);
    cx.fillRect(0,0,1,8);
    cx.fillRect(2,0,1,8);
    cx.restore();
  }

  if(mode==='celebrate'&&!walking){
    servingBowl(x,by-6,t);
  }

  if(mode==='thinking'&&!walking){
    // Thought bubble
    cx.fillStyle='rgba(255,255,255,0.9)';
    cx.beginPath();cx.arc(x+10,by-26,5,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(x+6,by-21,2,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(x+4,by-19,1,0,Math.PI*2);cx.fill();

    // Question mark
    cx.fillStyle=P.scrollAccent;
    cx.font='bold 5px monospace';
    cx.fillText('?',x+8,by-24);
  }
}

function render(t){
  // 1. Background
  nightSky(t);
  shopFrame(t);
  lanterns(t);
  stallSign();
  norenSign(t);

  // 2. Midground props (vertical layout)
  const scrollPos=menuScroll(t);  // thinking - upper
  const potPos=potAndFlame(t);     // cook - middle
  const prepPos=prepBoard(t);      // typing - lower middle
  const counterPos=counter(t);     // serve - bottom
  steam(t,IW*0.65,IH*0.32,mode==='running'?1.5:0.5);

  // Vertical station movement
  // thinking: up to menu scroll
  // running: center to pot
  // typing: down to prep board
  // celebrate: bottom to counter
  if(mode==='typing'){tx=prepPos.x;ty=prepPos.y;}
  else if(mode==='thinking'){tx=scrollPos.x;ty=scrollPos.y;}
  else if(mode==='running'){tx=potPos.x;ty=potPos.y;}
  else if(mode==='celebrate'){tx=counterPos.x;ty=counterPos.y-6;}
  else if(mode==='error'){tx=prepPos.x;ty=prepPos.y;}
  else{tx=IW*0.5;ty=IH*0.5;} // idle: center

  // Move character (mostly vertical)
  const dx=tx-mx,dy=ty-my,dist=Math.sqrt(dx*dx+dy*dy);
  if(dist>1){mx+=dx/dist*1.8;my+=dy/dist*1.8;}

  // 3. Character
  ninjaCook(mx,my,t);

  // 4. Lighting
  drawLighting();
  vignette();

  // 5. Foreground
  foreground(t);

  // 6. UI
  drawStatus();

  requestAnimationFrame(render);
}

localStorage.setItem('pixelhq_wsEndpoint',WS);
localStorage.setItem('pixelhq_token',TK);
connect();
requestAnimationFrame(render);
})();
</script>
</body>
</html>`;
}

function getPairPageHTML(ip: string, wsPort: number, token: string, isValid: boolean, companyName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName} - Pair</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,system-ui,sans-serif;background:linear-gradient(135deg,#0d1b2a,#1b263b);color:#f5f0e1;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .c{text-align:center;max-width:400px;background:linear-gradient(180deg,#2d3748,#1a202c);padding:40px;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,0.3);border:2px solid #5d4037}
    h1{font-size:2rem;margin-bottom:.5rem;color:#ff6b35}
    .sub{color:#ffd166;margin-bottom:2rem}
    .status{padding:1rem;border-radius:12px;margin-bottom:1.5rem}
    .status.ok{background:rgba(255,107,53,0.15);border:1px solid rgba(255,107,53,0.4)}
    .status.err{background:rgba(193,18,31,0.15);border:1px solid rgba(193,18,31,0.4)}
    .ip{font-family:monospace;font-size:1.1rem;color:#ffd166}
    .btn{display:inline-block;background:linear-gradient(135deg,#c1121f,#8b0000);color:#fff;padding:1rem 2rem;border-radius:30px;text-decoration:none;font-weight:600;transition:transform .2s,box-shadow .2s;border:2px solid #ffd166}
    .btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(193,18,31,0.4)}
    .note{margin-top:2rem;color:#a0aec0;font-size:.9rem}
    .emoji{font-size:2.5rem;margin-bottom:1rem}
  </style>
</head>
<body>
  <div class="c">
    <div class="emoji">🍜</div>
    <h1>${companyName}</h1>
    <p class="sub">Cozy ramen stall vibes for your AI</p>
    ${isValid ? `
    <div class="status ok"><p>Connected to</p><p class="ip">${ip}</p></div>
    <a href="/" class="btn">Enter the Stall 🏮</a>
    <p class="note">Tip: Add to Home Screen for fullscreen</p>
    ` : `
    <div class="status err"><p>Invalid or missing token</p><p style="font-size:.9rem;margin-top:.5rem">Scan the QR code again</p></div>
    `}
  </div>
  ${isValid ? `<script>
    localStorage.setItem('pixelhq_wsEndpoint','ws://${ip}:${wsPort}/ws?token=${token}');
    localStorage.setItem('pixelhq_token','${token}');
    localStorage.setItem('pixelhq_ip','${ip}');
  </script>` : ''}
</body>
</html>`;
}
