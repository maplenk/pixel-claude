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
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100vw;height:100vh;height:100dvh;overflow:hidden;background:#0d1b2a;touch-action:none;position:fixed;inset:0}
    #c{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges}
    #s{position:fixed;top:max(env(safe-area-inset-top),8px);left:50%;transform:translateX(-50%);padding:6px 14px;border-radius:16px;font:500 11px system-ui;z-index:100;background:rgba(255,255,255,.9);color:#333;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:opacity .3s,transform .3s}
    #s.e{background:rgba(255,100,100,.9);color:#fff}
    #s.h{opacity:0;transform:translateX(-50%) translateY(-20px);pointer-events:none}
  </style>
</head>
<body>
<canvas id="c"></canvas>
<div id="s" class="h"></div>
<script>
(()=>{
const WS='${wsEndpoint}',CO='${companyName}',TK='${token}';
const cv=document.getElementById('c'),cx=cv.getContext('2d');
let W=480,H=270,mode='idle',ws,rd=1e3;

function resize(){
  const w=innerWidth,h=innerHeight;
  const s=Math.max(w/480,h/270);
  W=Math.ceil(w/s);H=Math.ceil(h/s);
  cv.width=W;cv.height=H;
  cx.imageSmoothingEnabled=false;
}
resize();
addEventListener('resize',resize);

// Ramen stall color palette
const P={
  // Night sky
  sky:'#0d1b2a',skyLight:'#1b263b',stars:'#fff',
  // Lanterns
  lanternGlow:'#ff6b35',lanternBody:'#c1121f',lanternLight:'#ffd166',
  // Wood/stall
  wood:'#8b5a2b',woodLight:'#a0522d',woodDark:'#5d4037',counter:'#6d4c41',
  // Pot & flame
  pot:'#2d3748',potInner:'#1a202c',
  flame1:'#ff6b35',flame2:'#ffd166',flame3:'#ff8c42',broth:'#d4a574',
  // Scroll
  scroll:'#f5f0e1',scrollText:'#2d3748',scrollAccent:'#c1121f',
  // Prep
  board:'#deb887',knife:'#c0c0c0',noodles:'#f5deb3',veggies:'#68d391',
  // Bowl
  bowl:'#fff',ramen:'#f4a460',egg:'#ffd700',nori:'#2d5016',
  // Noren
  noren:'#c1121f',norenDark:'#8b0000',
  // Character
  skin:'#ffd9b3',hair:'#1a1a2e',headband:'#c1121f',outfit:'#2d3748',apron:'#fff'
};

// Character position
let mx=W*0.4,my=H*0.6,tx=mx,ty=my;

function connect(){
  ss('Connecting...');
  ws=new WebSocket(WS);
  ws.onopen=()=>{ss('Connected',2e3);rd=1e3;ws.send(JSON.stringify({type:'hello',version:1,client:'pwa',token:TK}))};
  ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='state')mode=m.mode}catch(e){}};
  ws.onclose=()=>{ss('Reconnecting...',0,1);setTimeout(connect,rd);rd=Math.min(rd*1.5,3e4)};
  ws.onerror=()=>ws.close();
}

function ss(t,h=0,e=0){
  const el=document.getElementById('s');
  if(!el)return;
  el.textContent=t;el.className=e?'e':'';
  if(h>0)setTimeout(()=>el.classList.add('h'),h);
}

// Night sky with stars
function nightSky(t){
  const g=cx.createLinearGradient(0,0,0,H*0.5);
  g.addColorStop(0,P.sky);g.addColorStop(1,P.skyLight);
  cx.fillStyle=g;cx.fillRect(0,0,W,H);

  // Twinkling stars
  for(let i=0;i<20;i++){
    const twinkle=Math.sin(t/500+i*47)>0.6;
    if(twinkle){
      cx.fillStyle=P.stars;
      const sx=(i*73)%W,sy=H*0.02+(i%7)*12;
      cx.fillRect(sx,sy,2,2);
    }
  }
}

// Hanging lanterns with glow
function lanterns(t){
  const positions=[W*0.12,W*0.88];
  positions.forEach((lx,i)=>{
    const sway=Math.sin(t/1000+i)*2;
    const ly=H*0.08;

    // String
    cx.strokeStyle=P.woodDark;cx.lineWidth=1;
    cx.beginPath();cx.moveTo(lx,0);cx.lineTo(lx+sway,ly);cx.stroke();

    // Glow effect
    const glowIntensity=0.25+Math.sin(t/200+i)*0.1;
    cx.fillStyle='rgba(255,107,53,'+glowIntensity+')';
    cx.beginPath();cx.arc(lx+sway,ly+12,25,0,Math.PI*2);cx.fill();

    // Lantern body
    cx.fillStyle=P.lanternBody;
    cx.fillRect(lx+sway-8,ly,16,24);

    // Lantern top/bottom
    cx.fillStyle=P.woodDark;
    cx.fillRect(lx+sway-10,ly-2,20,4);
    cx.fillRect(lx+sway-10,ly+22,20,4);

    // Inner glow
    cx.fillStyle=P.lanternLight;
    cx.globalAlpha=0.5+Math.sin(t/150+i)*0.2;
    cx.fillRect(lx+sway-5,ly+4,10,16);
    cx.globalAlpha=1;
  });
}

// Menu scroll (for thinking)
function menuScroll(t){
  const x=W*0.5,y=H*0.18;
  const sw=80,sh=50;

  // Scroll background
  cx.fillStyle=P.scroll;
  cx.fillRect(x-sw/2,y,sw,sh);

  // Scroll ends (rolled)
  cx.fillStyle=P.scrollAccent;
  cx.fillRect(x-sw/2-4,y-2,8,sh+4);
  cx.fillRect(x+sw/2-4,y-2,8,sh+4);

  // Menu text
  cx.fillStyle=P.scrollText;
  cx.font='10px monospace';
  const items=['ラーメン','味噌','塩','醤油'];
  items.forEach((item,i)=>{
    const highlight=mode==='thinking'&&Math.floor(t/500)%4===i;
    cx.fillStyle=highlight?P.scrollAccent:P.scrollText;
    cx.fillText(item,x-sw/2+12,y+14+i*10);
  });

  // Decorative border
  cx.strokeStyle=P.scrollAccent;cx.lineWidth=1;
  cx.strokeRect(x-sw/2+4,y+4,sw-8,sh-8);

  return {x,y:y+sh+30};
}

// Prep board (for typing/prep)
function prepBoard(t){
  const x=W*0.2,y=H*0.55;

  // Cutting board
  cx.fillStyle=P.board;
  cx.fillRect(x-30,y-15,60,25);
  cx.fillStyle=P.woodDark;
  cx.fillRect(x-30,y-15,60,3);

  // Ingredients on board
  cx.fillStyle=P.veggies;
  cx.fillRect(x-20,y-8,10,8);
  cx.fillRect(x-8,y-10,8,10);

  cx.fillStyle=P.noodles;
  cx.fillRect(x+5,y-8,18,8);

  // Knife (animated when prepping)
  if(mode==='typing'){
    const chop=Math.floor(t/100)%4;
    cx.fillStyle=P.knife;
    cx.save();
    cx.translate(x+25,y-5-chop*3);
    cx.fillRect(-2,-12,4,12);
    cx.fillStyle=P.woodDark;
    cx.fillRect(-3,0,6,4);
    cx.restore();
  }else{
    cx.fillStyle=P.knife;
    cx.fillRect(x+23,y-15,4,10);
    cx.fillStyle=P.woodDark;
    cx.fillRect(x+22,y-5,6,4);
  }

  return {x,y:y+20};
}

// Pot and flame (for running/cook)
function potAndFlame(t){
  const x=W*0.75,y=H*0.55;

  // Flames (always animated, brighter when cooking)
  const flameColors=[P.flame1,P.flame2,P.flame3];
  const intensity=mode==='running'?1:0.5;
  for(let i=0;i<5;i++){
    const fh=6+Math.sin(t/80+i*1.5)*4;
    cx.fillStyle=flameColors[i%3];
    cx.globalAlpha=intensity;
    cx.fillRect(x-12+i*6,y+8-fh,4,fh);
  }
  cx.globalAlpha=1;

  // Pot
  cx.fillStyle=P.pot;
  cx.fillRect(x-20,y-25,40,30);
  cx.fillStyle=P.broth;
  cx.fillRect(x-17,y-22,34,24);

  // Pot handles
  cx.fillStyle=P.pot;
  cx.fillRect(x-25,y-15,6,8);
  cx.fillRect(x+19,y-15,6,8);

  // Bubbles (when cooking)
  if(mode==='running'){
    for(let i=0;i<4;i++){
      const by=y-18+Math.sin(t/120+i*2)*4;
      const bx=x-12+i*8;
      cx.fillStyle='rgba(255,255,255,0.6)';
      cx.beginPath();cx.arc(bx,by,2+i%2,0,Math.PI*2);cx.fill();
    }
  }

  return {x,y:y+20};
}

// Counter with noren curtains
function counter(){
  const y=H*0.72;

  // Counter top
  cx.fillStyle=P.woodLight;
  cx.fillRect(0,y,W,6);
  cx.fillStyle=P.counter;
  cx.fillRect(0,y+6,W,4);

  // Counter front
  cx.fillStyle=P.wood;
  cx.fillRect(0,y+10,W,H-y-10);

  // Noren curtains (hanging fabric)
  const norenCount=Math.floor(W/50);
  for(let i=0;i<norenCount;i++){
    const nx=25+i*(W-50)/(norenCount-1);
    const sway=Math.sin(Date.now()/1000+i)*1;

    // Curtain panels
    cx.fillStyle=P.noren;
    cx.beginPath();
    cx.moveTo(nx-12,y+12);
    cx.lineTo(nx-10+sway,y+40);
    cx.lineTo(nx+10+sway,y+40);
    cx.lineTo(nx+12,y+12);
    cx.fill();

    // White pattern (simplified)
    cx.fillStyle='rgba(255,255,255,0.3)';
    cx.fillRect(nx-6+sway/2,y+20,12,3);
  }

  return {x:W*0.5,y:y+5};
}

// Serving bowl (for celebrate)
function servingBowl(x,y,t){
  // Bowl
  cx.fillStyle=P.bowl;
  cx.beginPath();
  cx.ellipse(x,y,14,6,0,0,Math.PI);
  cx.fill();

  // Ramen/broth
  cx.fillStyle=P.broth;
  cx.beginPath();
  cx.ellipse(x,y-1,12,4,0,0,Math.PI);
  cx.fill();

  // Noodles
  cx.fillStyle=P.noodles;
  for(let i=0;i<4;i++){
    cx.fillRect(x-8+i*5,y-3,3,1);
  }

  // Egg
  cx.fillStyle=P.egg;
  cx.beginPath();cx.arc(x+5,y-2,3,0,Math.PI*2);cx.fill();

  // Nori
  cx.fillStyle=P.nori;
  cx.fillRect(x-8,y-5,4,6);

  // Steam
  for(let i=0;i<3;i++){
    const sy=y-8-Math.sin(t/150+i*2)*3-(t/30+i*10)%15;
    const sx=x-4+i*4+Math.sin(t/200+i)*2;
    cx.fillStyle='rgba(255,255,255,'+(0.4-(t/30+i*10)%15/30)+')';
    cx.beginPath();cx.arc(sx,sy,2,0,Math.PI*2);cx.fill();
  }
}

// Steam effect
function steam(t,x,y,intensity=1){
  for(let i=0;i<6;i++){
    const age=(t/40+i*15)%50;
    const sy=y-age;
    const sx=x+Math.sin(t/180+i)*6;
    const alpha=Math.max(0,(0.5-age/100)*intensity);
    cx.fillStyle='rgba(255,255,255,'+alpha+')';
    cx.beginPath();cx.arc(sx,sy,3+age/15,0,Math.PI*2);cx.fill();
  }
}

// Ninja cook character
function ninjaCook(x,y,t){
  const anim=Math.floor(t/200)%4;
  let bob=0,arm=0,walking=false;

  const dx=tx-mx,dy=ty-my,dist=Math.sqrt(dx*dx+dy*dy);
  if(dist>2){walking=true;bob=Math.sin(t/80)*2;}

  if(!walking){
    if(mode==='typing'){arm=anim%2?-3:0;bob=anim%2?-1:0;}
    else if(mode==='running'){arm=Math.sin(t/250)*3;}
    else if(mode==='thinking'){arm=-2;}
    else if(mode==='celebrate'){bob=-anim;arm=-2;}
    else if(mode==='error'){bob=anim%2*2;}
  }

  const by=y+bob;

  // Shadow
  cx.fillStyle='rgba(0,0,0,0.2)';
  cx.beginPath();cx.ellipse(x,y+2,8,3,0,0,Math.PI*2);cx.fill();

  // Legs
  cx.fillStyle=P.outfit;
  if(walking){
    const legAnim=Math.sin(t/80)*3;
    cx.fillRect(x-3,by-8+legAnim,2,6);
    cx.fillRect(x+1,by-8-legAnim,2,6);
  }else{
    cx.fillRect(x-3,by-8,2,6);
    cx.fillRect(x+1,by-8,2,6);
  }

  // Body (outfit)
  cx.fillStyle=P.outfit;
  cx.fillRect(x-5,by-18,10,12);

  // Apron
  cx.fillStyle=P.apron;
  cx.fillRect(x-4,by-15,8,10);

  // Arms
  cx.fillStyle=P.outfit;
  cx.fillRect(x-7,by-16+arm,2,8);
  cx.fillRect(x+5,by-16+(mode==='thinking'?0:arm),2,8);

  // Hands
  cx.fillStyle=P.skin;
  cx.fillRect(x-7,by-8+arm,2,3);
  cx.fillRect(x+5,by-8+(mode==='thinking'?-4:arm),2,3);

  // Head
  cx.fillStyle=P.skin;
  cx.fillRect(x-4,by-26,8,8);

  // Hair
  cx.fillStyle=P.hair;
  cx.fillRect(x-5,by-28,10,4);

  // Headband
  cx.fillStyle=P.headband;
  cx.fillRect(x-6,by-26,12,3);
  // Headband tails
  cx.fillRect(x+5,by-25,6,2);
  cx.fillRect(x+9,by-24,4,2);

  // Eyes
  cx.fillStyle='#1a202c';
  if(Math.floor(t/2500)%8!==0){
    cx.fillRect(x-2,by-23,1,2);
    cx.fillRect(x+1,by-23,1,2);
  }

  // Mode-specific effects
  if(mode==='error'&&!walking){
    // Sweat drop
    cx.fillStyle='#90cdf4';
    cx.beginPath();
    cx.moveTo(x+7,by-24);
    cx.lineTo(x+9,by-20);
    cx.lineTo(x+5,by-20);
    cx.fill();

    // Dropped chopsticks
    cx.fillStyle=P.wood;
    cx.save();
    cx.translate(x+12,by-5);
    cx.rotate(Math.PI/4+Math.sin(t/50)*0.1);
    cx.fillRect(0,0,2,14);
    cx.fillRect(4,0,2,14);
    cx.restore();
  }

  if(mode==='celebrate'&&!walking){
    // Holding bowl
    servingBowl(x,by-8,t);
  }

  if(mode==='thinking'&&!walking){
    // Thought bubble
    cx.fillStyle='rgba(255,255,255,0.9)';
    cx.beginPath();cx.arc(x+16,by-34,8,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(x+9,by-28,3,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(x+6,by-25,2,0,Math.PI*2);cx.fill();

    // Thinking content
    cx.fillStyle=P.scrollAccent;
    cx.font='bold 8px monospace';
    cx.fillText(['?','🍜','!'][Math.floor(t/500)%3],x+12,by-32);
  }
}

// Decorations (bamboo, sake bottles)
function decorations(){
  // Bamboo on left
  cx.fillStyle='#2d5016';
  cx.fillRect(W*0.03,H*0.3,4,H*0.4);
  cx.fillRect(W*0.05,H*0.25,3,H*0.45);

  // Bamboo leaves
  cx.fillStyle='#48bb78';
  cx.beginPath();cx.ellipse(W*0.05,H*0.28,8,3,-0.5,0,Math.PI*2);cx.fill();
  cx.beginPath();cx.ellipse(W*0.03,H*0.32,6,2,0.3,0,Math.PI*2);cx.fill();

  // Sake bottles on right
  cx.fillStyle='#f5f0e1';
  cx.fillRect(W*0.92,H*0.5,8,20);
  cx.fillRect(W*0.94,H*0.48,6,22);
  cx.fillStyle=P.scrollAccent;
  cx.fillRect(W*0.92,H*0.52,8,3);
  cx.fillRect(W*0.94,H*0.53,6,3);
}

// Stall sign
function stallSign(){
  const sw=CO.length*10+24,sx=W*0.5-sw/2,sy=H*0.06;

  // Sign board
  cx.fillStyle=P.wood;
  cx.fillRect(sx-4,sy-4,sw+8,32);
  cx.fillStyle=P.scroll;
  cx.fillRect(sx,sy,sw,24);

  // Text
  cx.fillStyle=P.scrollAccent;
  cx.font='bold 12px monospace';
  cx.fillText(CO,sx+12,sy+16);

  // Decorative corners
  cx.fillStyle=P.scrollAccent;
  cx.fillRect(sx,sy,4,4);
  cx.fillRect(sx+sw-4,sy,4,4);
  cx.fillRect(sx,sy+20,4,4);
  cx.fillRect(sx+sw-4,sy+20,4,4);
}

function render(t){
  nightSky(t);
  lanterns(t);
  stallSign();
  decorations();

  // Draw all areas
  const scrollPos=menuScroll(t);
  const prepPos=prepBoard(t);
  const potPos=potAndFlame(t);
  const counterPos=counter();

  // Steam from pot (always, more intense when cooking)
  steam(t,W*0.75,H*0.35,mode==='running'?1.5:0.5);

  // Determine target position based on mode
  if(mode==='typing'){tx=prepPos.x;ty=prepPos.y;}
  else if(mode==='thinking'){tx=scrollPos.x;ty=scrollPos.y;}
  else if(mode==='running'){tx=potPos.x;ty=potPos.y;}
  else if(mode==='celebrate'){tx=counterPos.x;ty=counterPos.y-10;}
  else if(mode==='error'){tx=prepPos.x;ty=prepPos.y;}
  else{tx=W*0.45;ty=H*0.62;}

  // Move character
  const dx=tx-mx,dy=ty-my,dist=Math.sqrt(dx*dx+dy*dy);
  if(dist>1){mx+=dx/dist*2.5;my+=dy/dist*2.5;}

  // Draw character
  ninjaCook(mx,my,t);

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
