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
    if (event.tool === 'Write' || event.tool === 'Edit') {
      stateMachine.emit('typing', 5000);
    } else if (event.tool === 'Bash') {
      stateMachine.emit('running', 10000);
    } else if (event.tool === 'Read' || event.tool === 'Grep' || event.tool === 'Glob') {
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
  <meta name="theme-color" content="#c9b8db">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>${companyName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100vw;height:100vh;height:100dvh;overflow:hidden;background:#c9b8db;touch-action:none;position:fixed;inset:0}
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

// Colors
const P={
  fl:'#d4c4e3',fl2:'#c9b8db',fll:'#b8a5cc',
  wl:'#e8dff0',wl2:'#d4c4e3',
  dk:'#8b7355',dkt:'#a08568',dkd:'#6b5344',
  ch:'#5a67d8',chd:'#4c51bf',
  mn:'#2d3748',ms:'#1a1a2e',mg:'#00ff88',
  pl:'#68d391',pld:'#48bb78',pt:'#e53e3e',ptd:'#c53030',
  wn:'#87ceeb',wnf:'#4a5568',
  sh:'#a08568',shd:'#8b7355',
  bk1:'#fc8181',bk2:'#63b3ed',bk3:'#68d391',bk4:'#f6e05e',bk5:'#b794f4',
  sf:'#667eea',sfd:'#5a67d8',
  rg:'#fbd38d',rgd:'#f6ad55',
  sg:'#fff',sgt:'#2d3748',
  wb:'#fff',wbf:'#4a5568',
  sk:'#ffd9b3',hr:'#4a3728',sr:'#667eea',pn:'#2d3748',so:'#1a202c'
};

// Character (single developer)
const charColor={sk:'#ffd9b3',hr:'#4a3728',sr:'#667eea'};
let mx=W*0.25,my=H*0.6,tx=mx,ty=my;

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
  el.textContent=t;el.className=e?'e':'';
  if(h>0)setTimeout(()=>el.classList.add('h'),h);
}

function floor(){
  cx.fillStyle=P.fl;cx.fillRect(0,0,W,H);
  const ts=Math.max(16,Math.min(24,W/20));
  for(let y=0;y<H;y+=ts)for(let x=0;x<W;x+=ts){
    cx.fillStyle=((Math.floor(x/ts)+Math.floor(y/ts))%2)?P.fl:P.fl2;
    cx.fillRect(x,y,ts,ts);
    cx.strokeStyle=P.fll;cx.lineWidth=.5;cx.strokeRect(x,y,ts,ts);
  }
}

function walls(){
  const wh=H*0.22;
  cx.fillStyle=P.wl;cx.fillRect(0,0,W,wh);
  cx.fillStyle=P.wl2;cx.fillRect(0,wh-5,W,8);
  cx.fillStyle='#b8a5cc';cx.fillRect(0,wh,W,3);
}

function sign(){
  const sw=CO.length*10+20,sx=W*0.5-sw/2,sy=H*0.04;
  cx.fillStyle=P.sg;cx.fillRect(sx,sy,sw,28);
  cx.strokeStyle=P.sgt;cx.lineWidth=2;cx.strokeRect(sx,sy,sw,28);
  cx.fillStyle=P.sgt;cx.font='bold 14px monospace';cx.fillText(CO,sx+10,sy+19);
}

function windows(t){
  const wx=W*0.85,wy=H*0.04,ws=Math.min(40,W*0.1);
  cx.fillStyle=P.wnf;cx.fillRect(wx-3,wy-3,ws+6,ws+6);
  const g=cx.createLinearGradient(wx,wy,wx,wy+ws);
  g.addColorStop(0,'#a8d8ea');g.addColorStop(1,'#87ceeb');
  cx.fillStyle=g;cx.fillRect(wx,wy,ws,ws);
  cx.strokeStyle=P.wnf;cx.lineWidth=2;
  cx.beginPath();cx.moveTo(wx+ws/2,wy);cx.lineTo(wx+ws/2,wy+ws);cx.moveTo(wx,wy+ws/2);cx.lineTo(wx+ws,wy+ws/2);cx.stroke();

  cx.fillStyle='rgba(255,255,255,0.7)';
  const cx1=wx+ws*0.2+Math.sin(t/2000)*4;
  cx.beginPath();cx.arc(cx1,wy+ws*0.3,3,0,Math.PI*2);cx.arc(cx1+5,wy+ws*0.25,4,0,Math.PI*2);cx.arc(cx1+10,wy+ws*0.3,3,0,Math.PI*2);cx.fill();
}

// Desk workstation (for typing/coding)
function desk(t){
  const x=W*0.25,y=H*0.55;

  // Chair
  cx.fillStyle=P.chd;cx.fillRect(x-8,y+15,16,8);
  cx.fillStyle=P.ch;cx.fillRect(x-10,y,20,18);

  // Desk
  cx.fillStyle=P.dkd;cx.fillRect(x-30,y-8,60,5);
  cx.fillStyle=P.dk;cx.fillRect(x-30,y-3,60,12);
  cx.fillStyle=P.dkt;cx.fillRect(x-30,y-10,60,4);

  // Monitor
  cx.fillStyle=P.mn;cx.fillRect(x-12,y-30,24,18);
  cx.fillStyle=P.ms;cx.fillRect(x-10,y-28,20,14);

  // Screen content
  if(mode==='typing'){
    cx.fillStyle='rgba(0,255,136,0.15)';cx.fillRect(x-10,y-28,20,14);
    cx.fillStyle=P.mg;
    for(let l=0;l<4;l++)cx.fillRect(x-8,y-26+l*3,10+Math.sin(t/200+l)*4,2);
    if(Math.floor(t/300)%2)cx.fillRect(x+6,y-26+9,2,2);
  }else{
    cx.fillStyle=P.mg;cx.fillRect(x-8,y-26,4,2);cx.fillRect(x-2,y-26,8,2);
    if(Math.floor(t/600)%2)cx.fillRect(x-8,y-22,4,2);
  }

  // Monitor stand
  cx.fillStyle=P.mn;cx.fillRect(x-3,y-12,6,4);cx.fillRect(x-6,y-9,12,2);

  // Keyboard
  cx.fillStyle='#4a5568';cx.fillRect(x-10,y-5,20,4);

  return {x,y:y+20};
}

// Meeting room with whiteboard (for thinking)
function meetingRoom(t){
  const mx=W*0.7,my=H*0.35;

  // Whiteboard on wall
  const wbw=Math.min(80,W*0.18),wbh=Math.min(50,H*0.2);
  cx.fillStyle=P.wbf;cx.fillRect(mx-wbw/2-3,my-wbh-3,wbw+6,wbh+6);
  cx.fillStyle=P.wb;cx.fillRect(mx-wbw/2,my-wbh,wbw,wbh);

  // Content on whiteboard
  cx.fillStyle='#4a5568';
  if(mode==='thinking'){
    // Animated diagrams
    const frame=Math.floor(t/400)%3;
    cx.fillRect(mx-wbw/2+8,my-wbh+10,wbw*0.3,2);
    cx.fillRect(mx-wbw/2+8,my-wbh+18,wbw*0.5,2);
    cx.fillRect(mx-wbw/2+8,my-wbh+26,wbw*0.2,2);
    // Box diagram
    cx.strokeStyle='#5a67d8';cx.lineWidth=2;
    cx.strokeRect(mx+5,my-wbh+8,20,15);
    if(frame>0)cx.strokeRect(mx+30,my-wbh+8,15,15);
    if(frame>1){cx.beginPath();cx.moveTo(mx+25,my-wbh+15);cx.lineTo(mx+30,my-wbh+15);cx.stroke();}
  }else{
    cx.fillRect(mx-wbw/2+8,my-wbh+10,wbw*0.4,2);
    cx.fillRect(mx-wbw/2+8,my-wbh+20,wbw*0.6,2);
  }

  // Meeting table
  cx.fillStyle=P.dkt;cx.fillRect(mx-25,my+10,50,30);
  cx.fillStyle=P.dk;cx.fillRect(mx-25,my+8,50,5);

  // Chairs around table
  cx.fillStyle=P.ch;
  cx.fillRect(mx-35,my+18,10,15);
  cx.fillRect(mx+25,my+18,10,15);

  return {x:mx,y:my+50};
}

// Terminal/Running area
function terminal(t){
  const tx=W*0.15,ty=H*0.85;

  // Server rack / terminal
  cx.fillStyle='#2d3748';cx.fillRect(tx-20,ty-50,40,50);
  cx.fillStyle='#1a202c';cx.fillRect(tx-18,ty-48,36,20);

  // Blinking lights
  const colors=['#48bb78','#ed8936','#63b3ed'];
  for(let i=0;i<3;i++){
    cx.fillStyle=(mode==='running'&&Math.floor(t/100+i*50)%2)?colors[i]:'#4a5568';
    cx.fillRect(tx-15+i*12,ty-42,6,4);
  }

  // Screen
  cx.fillStyle=P.ms;cx.fillRect(tx-15,ty-35,30,15);
  if(mode==='running'){
    cx.fillStyle=P.mg;
    const o=Math.floor(t/60)%5;
    for(let l=0;l<4;l++)cx.fillRect(tx-13,ty-33+((l+o)%5)*3,20-(l*4)%15,2);
  }else{
    cx.fillStyle='#4a5568';cx.fillRect(tx-10,ty-32,10,2);
  }

  return {x:tx,y:ty};
}

// Lounge area (for idle/celebrate)
function lounge(){
  const lx=W*0.75,ly=H*0.75;

  // Rug
  cx.fillStyle=P.rg;cx.fillRect(lx-30,ly-10,70,40);
  cx.strokeStyle=P.rgd;cx.lineWidth=2;cx.strokeRect(lx-28,ly-8,66,36);

  // Couch
  cx.fillStyle=P.sfd;cx.fillRect(lx-20,ly-25,50,20);
  cx.fillStyle=P.sf;cx.fillRect(lx-20,ly-30,50,8);cx.fillRect(lx-25,ly-25,8,25);cx.fillRect(lx+27,ly-25,8,25);

  // Cushions
  cx.fillStyle='#7c3aed';cx.fillRect(lx-12,ly-22,14,12);cx.fillRect(lx+10,ly-22,14,12);

  // Coffee table
  cx.fillStyle=P.dkt;cx.fillRect(lx-5,ly+5,30,15);
  cx.fillStyle=P.dk;cx.fillRect(lx-5,ly+3,30,4);

  // Coffee cup
  cx.fillStyle='#fff';cx.fillRect(lx+2,ly+8,8,6);
  cx.fillStyle='#8b7355';cx.fillRect(lx+3,ly+9,6,4);

  return {x:lx+10,y:ly};
}

function plant(x,y,s=1){
  cx.fillStyle=P.pt;cx.fillRect(x-6*s,y-10*s,12*s,10*s);
  cx.fillStyle=P.ptd;cx.fillRect(x-7*s,y-12*s,14*s,3*s);
  cx.fillStyle=P.pl;
  cx.beginPath();cx.ellipse(x-5*s,y-18*s,4*s,6*s,-.3,0,Math.PI*2);cx.fill();
  cx.beginPath();cx.ellipse(x+5*s,y-16*s,4*s,6*s,.3,0,Math.PI*2);cx.fill();
  cx.beginPath();cx.ellipse(x,y-22*s,3*s,6*s,0,0,Math.PI*2);cx.fill();
  cx.fillStyle=P.pld;cx.fillRect(x-1*s,y-16*s,2*s,6*s);
}

function worker(x,y,t){
  const anim=Math.floor(t/200)%4;
  let bob=0,arm=0,walking=false;

  const dx=tx-mx,dy=ty-my,dist=Math.sqrt(dx*dx+dy*dy);
  if(dist>2){walking=true;bob=Math.sin(t/80)*2;}

  if(!walking){
    if(mode==='typing'){arm=anim%2?-1:1;bob=anim%2?-1:0;}
    else if(mode==='running'){bob=Math.sin(anim*Math.PI/2)*2;}
    else if(mode==='celebrate'){bob=-anim;arm=-3-anim;}
    else if(mode==='error'){bob=anim%2;}
    else if(mode==='thinking'){arm=-2;}
  }

  const by=y+bob;

  // Shadow
  cx.fillStyle='rgba(0,0,0,0.1)';cx.beginPath();cx.ellipse(x,y+2,6,2,0,0,Math.PI*2);cx.fill();

  // Legs
  cx.fillStyle=P.pn;
  if(walking){
    const legAnim=Math.sin(t/80)*3;
    cx.fillRect(x-3,by-8+legAnim,2,6);cx.fillRect(x+1,by-8-legAnim,2,6);
  }else{
    cx.fillRect(x-3,by-8,2,6);cx.fillRect(x+1,by-8,2,6);
  }

  // Body
  cx.fillStyle=charColor.sr;cx.fillRect(x-4,by-16,8,10);

  // Arms
  cx.fillRect(x-6,by-14+arm,2,6);cx.fillRect(x+4,by-14+(mode==='thinking'?0:arm),2,6);

  // Hands
  cx.fillStyle=charColor.sk;cx.fillRect(x-6,by-8+arm,2,2);cx.fillRect(x+4,by-8+(mode==='thinking'?-4:arm),2,2);

  // Head
  cx.fillRect(x-4,by-24,8,8);

  // Hair
  cx.fillStyle=charColor.hr;cx.fillRect(x-5,by-26,10,4);cx.fillRect(x-5,by-24,2,2);cx.fillRect(x+3,by-24,2,2);

  // Eyes
  cx.fillStyle='#1a202c';
  if(Math.floor(t/2500)%8!==0){cx.fillRect(x-2,by-22,1,2);cx.fillRect(x+1,by-22,1,2);}

  // Effects based on mode
  if(mode==='typing'&&!walking){
    const df=Math.floor(t/150)%3;
    for(let i=0;i<3;i++){cx.fillStyle=i===df?P.mg:'rgba(0,255,136,0.3)';cx.fillRect(x+10+i*3,by-20,2,2);}
  }else if(mode==='thinking'&&!walking){
    cx.fillStyle='rgba(255,255,255,0.9)';
    cx.beginPath();cx.arc(x+14,by-32,7,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(x+8,by-26,3,0,Math.PI*2);cx.fill();
    cx.fillStyle='#805ad5';cx.font='bold 7px monospace';cx.fillText(['?','..','!'][Math.floor(t/500)%3],x+11,by-30);
  }else if(mode==='celebrate'&&!walking){
    const cols=[P.bk4,P.pl,P.bk1,'#00d9ff'];
    for(let i=0;i<6;i++){
      const a=(i*Math.PI*2)/6+t/400,d=12+Math.sin(t/150+i)*4;
      cx.fillStyle=cols[i%4];cx.fillRect(x+Math.cos(a)*d-1,by-16+Math.sin(a)*d-1,3,3);
    }
  }else if(mode==='error'&&!walking){
    cx.fillStyle='#f56565';cx.fillRect(x-1,by-38,3,6);cx.fillRect(x-1,by-30,3,2);
  }
}

function render(t){
  floor();
  walls();
  windows(t);
  sign();

  // Draw all areas
  const deskPos=desk(t);
  const meetPos=meetingRoom(t);
  const termPos=terminal(t);
  const loungePos=lounge();

  // Plants
  plant(W*0.05,H*0.9,0.8);
  plant(W*0.45,H*0.22,0.6);
  plant(W*0.92,H*0.9,0.9);

  // Determine target position based on mode
  if(mode==='typing'){tx=deskPos.x;ty=deskPos.y;}
  else if(mode==='thinking'){tx=meetPos.x;ty=meetPos.y;}
  else if(mode==='running'){tx=termPos.x;ty=termPos.y;}
  else if(mode==='celebrate'||mode==='idle'){tx=loungePos.x;ty=loungePos.y;}
  else if(mode==='error'){tx=deskPos.x;ty=deskPos.y;}

  // Move character
  const dx=tx-mx,dy=ty-my,dist=Math.sqrt(dx*dx+dy*dy);
  if(dist>1){mx+=dx/dist*2;my+=dy/dist*2;}

  // Draw character
  worker(mx,my,t);

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
    body{font-family:-apple-system,system-ui,sans-serif;background:linear-gradient(135deg,#c9b8db,#e8dff0);color:#333;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .c{text-align:center;max-width:400px;background:#fff;padding:40px;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,0.1)}
    h1{font-size:2rem;margin-bottom:.5rem;color:#5a67d8}
    .sub{color:#666;margin-bottom:2rem}
    .status{padding:1rem;border-radius:12px;margin-bottom:1.5rem}
    .status.ok{background:rgba(72,187,120,0.15);border:1px solid rgba(72,187,120,0.3)}
    .status.err{background:rgba(245,101,101,0.15);border:1px solid rgba(245,101,101,0.3)}
    .ip{font-family:monospace;font-size:1.1rem;color:#48bb78}
    .btn{display:inline-block;background:linear-gradient(135deg,#667eea,#5a67d8);color:#fff;padding:1rem 2rem;border-radius:30px;text-decoration:none;font-weight:600;transition:transform .2s,box-shadow .2s}
    .btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(102,126,234,0.3)}
    .note{margin-top:2rem;color:#888;font-size:.9rem}
  </style>
</head>
<body>
  <div class="c">
    <h1>${companyName}</h1>
    <p class="sub">Pixel art vibes for your AI</p>
    ${isValid ? `
    <div class="status ok"><p>Connected to</p><p class="ip">${ip}</p></div>
    <a href="/" class="btn">Open ${companyName}</a>
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
