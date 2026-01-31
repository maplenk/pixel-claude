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
      res.end(getOfficeHTML(localIP, wsPort, token, companyName));
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

function getOfficeHTML(ip: string, wsPort: number, token: string, companyName: string): string {
  const wsEndpoint = `ws://${ip}:${wsPort}/ws?token=${token}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <meta name="theme-color" content="#1a202c">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>${companyName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100vw;height:100vh;height:100dvh;overflow:hidden;background:#1a202c;touch-action:none;position:fixed;inset:0}
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

// Portrait mode: 180x320
const IW=180,IH=320;
let mode='idle',ws,rd=1e3;

function resize(){
  const w=innerWidth,h=innerHeight;
  const s=Math.min(w/IW,h/IH);
  cv.width=IW;cv.height=IH;
  cv.style.width=Math.floor(IW*s)+'px';
  cv.style.height=Math.floor(IH*s)+'px';
  cv.style.left=Math.floor((w-IW*s)/2)+'px';
  cv.style.top=Math.floor((h-IH*s)/2)+'px';
  cx.imageSmoothingEnabled=false;
}
resize();
addEventListener('resize',resize);

// Colors
const P={
  sky:'#0a1628',skyMid:'#152238',skyLight:'#1e3a5f',
  cityDark:'#0d1018',cityWindow:'#ffd166',cityWindowDim:'#a08040',
  wallDark:'#1a202c',wallMid:'#2d3748',wallLight:'#3d4852',trim:'#4a5568',
  floorDark:'#1a202c',floorMid:'#252d38',
  deskDark:'#4a3728',deskMid:'#5d4a3a',deskLight:'#7a5f4a',deskHighlight:'#8b7355',
  chairDark:'#2d3748',chairMid:'#3d4852',
  monitorFrame:'#1a1a2e',monitorScreen:'#0d1117',
  screenGlow:'#00ff88',screenGlowDim:'rgba(0,255,136,0.1)',errorGlow:'#f56565',celebrateGlow:'#f6e05e',
  serverDark:'#1a1a2e',serverMid:'#2d3748',serverLight:'#3d4852',serverLED:'#00ff88',serverLEDOff:'#1a2030',serverError:'#f56565',
  boardFrame:'#4a5568',boardFrameDark:'#3d4852',boardSurface:'#e2e8f0',
  markerBlue:'#3182ce',markerPurple:'#805ad5',
  stickyYellow:'#f6e05e',stickyPink:'#ed64a6',stickyBlue:'#63b3ed',stickyGreen:'#68d391',
  sofaDark:'#3d4852',sofaMid:'#4a5568',sofaLight:'#5a6a7a',
  gongGold:'#d69e2e',gongGoldDark:'#b7791f',gongGoldLight:'#ecc94b',gongStand:'#4a3728',
  machineDark:'#1a202c',machineMid:'#2d3748',
  potTerracotta:'#c53030',potTerracottaDark:'#9b2c2c',
  leafGreen:'#48bb78',leafGreenDark:'#38a169',leafHighlight:'#68d391',
  shelfWood:'#5d4a3a',shelfWoodDark:'#4a3728',
  bookRed:'#c53030',bookBlue:'#3182ce',bookGreen:'#38a169',bookYellow:'#d69e2e',bookPurple:'#805ad5',
  mugBody:'#e2e8f0',coffeeDark:'#5d4037',steam:'rgba(255,255,255,0.25)',
  basketDark:'#3d4852',basketMid:'#4a5568',paper:'#e2e8f0',paperCrumpled:'#cbd5e0',
  skin:'#ffd9b3',hair:'#4a3728',shirtBlue:'#3182ce',shirtBlueDark:'#2c5282',pantsDark:'#2d3748',shoes:'#1a202c',
  shadow:'rgba(0,0,0,0.3)',shadowLight:'rgba(0,0,0,0.15)',
  lightFixture:'#3d4852',lightGlow:'#ffeaa7',lightGlowDim:'rgba(255,234,167,0.3)',
  posterBg:'#2d3748',posterAccent:'#48bb78',
  confetti:['#f6e05e','#48bb78','#ed8936','#63b3ed','#f56565','#805ad5']
};

// Stations (portrait layout)
const STATIONS={
  whiteboard:{x:IW*0.5,y:75,width:70,height:45,charPos:{x:IW*0.5,y:130}},
  serverRack:{x:IW*0.72,y:140,width:32,height:55,charPos:{x:IW*0.55,y:195}},
  desk:{x:IW*0.5,y:215,charPos:{x:IW*0.5,y:245}},
  lounge:{sofaX:IW*0.25,gongX:IW*0.78,y:275,charPos:{x:IW*0.5,y:290}},
  idle:{charPos:{x:IW*0.5,y:200}}
};

// Animation timing
const ANIM={starTwinkle:500,plantSway:1000,stickyNoteSway:800,steamRise:200,ledScan:100,typing:80,confetti:35,walkCycle:70,blink:2000,gongRing:150,lightFlicker:3000};

// Character state
let charX=STATIONS.idle.charPos.x,charY=STATIONS.idle.charPos.y;
const MOVE_SPEED=2;

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

function getTarget(){
  switch(mode){
    case 'thinking':return STATIONS.whiteboard.charPos;
    case 'running':return STATIONS.serverRack.charPos;
    case 'typing':return STATIONS.desk.charPos;
    case 'celebrate':return STATIONS.lounge.charPos;
    case 'error':return STATIONS.desk.charPos;
    default:return STATIONS.idle.charPos;
  }
}

function updateChar(target){
  const dx=target.x-charX,dy=target.y-charY,dist=Math.sqrt(dx*dx+dy*dy);
  if(dist>MOVE_SPEED){charX+=dx/dist*MOVE_SPEED;charY+=dy/dist*MOVE_SPEED;}
  else{charX=target.x;charY=target.y;}
}

function drawSkyWindow(t){
  const wx=IW*0.5-30,wy=15,ww=60,wh=40;
  cx.fillStyle=P.shadow;cx.fillRect(wx+2,wy+2,ww,wh);
  cx.fillStyle=P.wallLight;cx.fillRect(wx-3,wy-3,ww+6,wh+6);
  const g=cx.createLinearGradient(wx,wy,wx,wy+wh);
  g.addColorStop(0,P.sky);g.addColorStop(0.5,P.skyMid);g.addColorStop(1,P.skyLight);
  cx.fillStyle=g;cx.fillRect(wx,wy,ww,wh);
  // City
  cx.fillStyle=P.cityDark;
  [[0,8,18],[10,6,22],[18,10,15],[30,7,25],[40,8,20],[50,10,12]].forEach(b=>{
    cx.fillRect(wx+b[0],wy+wh-b[2],b[1],b[2]);
    if(b[2]>15)for(let r=0;r<Math.floor(b[2]/5);r++)for(let c=0;c<Math.floor(b[1]/4);c++){
      const on=Math.sin(t/2000+b[0]+r*3+c)>0;
      cx.fillStyle=on?P.cityWindow:P.cityWindowDim;cx.globalAlpha=on?0.8:0.2;
      cx.fillRect(wx+b[0]+c*4+1,wy+wh-b[2]+r*5+2,2,2);
    }
  });
  cx.globalAlpha=1;
  // Stars
  cx.fillStyle='#fff';
  [[5,5],[15,8],[35,4],[50,10],[25,6]].forEach(([sx,sy])=>{
    if(Math.sin(t/ANIM.starTwinkle+sx)>0.3){cx.globalAlpha=0.5+Math.sin(t/300+sx)*0.3;cx.fillRect(wx+sx,wy+sy,1,1);}
  });
  cx.globalAlpha=1;
  // Panes
  cx.strokeStyle=P.wallLight;cx.lineWidth=2;
  cx.beginPath();cx.moveTo(wx+ww/2,wy);cx.lineTo(wx+ww/2,wy+wh);cx.moveTo(wx,wy+wh/2);cx.lineTo(wx+ww,wy+wh/2);cx.stroke();
}

function drawWalls(){
  cx.fillStyle=P.wallDark;cx.fillRect(0,0,8,IH);cx.fillRect(IW-8,0,8,IH);
  cx.fillStyle=P.wallMid;cx.fillRect(7,0,1,IH);cx.fillRect(IW-8,0,1,IH);
  const g=cx.createLinearGradient(0,0,0,140);
  g.addColorStop(0,P.wallDark);g.addColorStop(1,P.wallMid);
  cx.fillStyle=g;cx.fillRect(8,60,IW-16,80);
  cx.fillStyle=P.trim;cx.fillRect(8,255,IW-16,3);
}

function drawCeilingLights(t){
  [IW*0.3,IW*0.7].forEach((lx,i)=>{
    cx.strokeStyle=P.wallDark;cx.lineWidth=1;cx.beginPath();cx.moveTo(lx,0);cx.lineTo(lx,8);cx.stroke();
    cx.fillStyle=P.lightFixture;cx.fillRect(lx-8,8,16,4);
    const f=Math.sin(t/ANIM.lightFlicker+i)>0.95?0.5:1;
    cx.fillStyle=P.lightGlowDim;cx.globalAlpha=0.3*f;cx.beginPath();cx.arc(lx,23,25,0,Math.PI*2);cx.fill();
    cx.globalAlpha=1;cx.fillStyle=P.lightGlow;cx.globalAlpha=0.8*f;cx.fillRect(lx-4,11,8,3);cx.globalAlpha=1;
  });
}

function drawFloor(){
  const g=cx.createLinearGradient(0,258,0,IH);
  g.addColorStop(0,P.floorMid);g.addColorStop(1,P.floorDark);
  cx.fillStyle=g;cx.fillRect(8,258,IW-16,IH-258);
  cx.strokeStyle='rgba(0,0,0,0.1)';cx.lineWidth=1;
  for(let x=8;x<IW-8;x+=20){cx.beginPath();cx.moveTo(x,258);cx.lineTo(x,IH);cx.stroke();}
  for(let y=258;y<IH;y+=15){cx.beginPath();cx.moveTo(8,y);cx.lineTo(IW-8,y);cx.stroke();}
}

function drawSign(){
  const sx=IW*0.5-25,sy=62;
  cx.fillStyle=P.shadow;cx.fillRect(sx+2,sy+2,50,10);
  cx.fillStyle=P.trim;cx.fillRect(sx-2,sy-2,54,14);
  cx.fillStyle=P.posterBg;cx.fillRect(sx,sy,50,10);
  cx.fillStyle=P.posterAccent;cx.font='bold 6px monospace';cx.fillText(CO.slice(0,7),sx+8,sy+7);
}

function drawPoster(){
  cx.fillStyle=P.posterBg;cx.fillRect(12,80,18,24);
  cx.fillStyle=P.posterAccent;cx.fillRect(14,82,14,5);
  cx.fillStyle='#fff';cx.font='4px monospace';cx.fillText('SHIP',15,86);cx.fillText('IT!',17,94);
  cx.fillStyle=P.posterBg;cx.fillRect(IW-30,80,16,22);
  cx.fillStyle=P.screenGlow;cx.font='7px monospace';cx.fillText('{',IW-27,90);cx.fillText('}',IW-22,98);
}

function drawWhiteboard(t){
  const {x,y,width:w,height:h}=STATIONS.whiteboard,bx=x-w/2,by=y-h/2;
  if(mode!=='thinking')cx.globalAlpha=0.6;
  cx.fillStyle=P.shadowLight;cx.fillRect(bx+2,by+2,w,h);
  cx.fillStyle=P.boardFrame;cx.fillRect(bx-3,by-3,w+6,h+6);
  cx.fillStyle=P.boardSurface;cx.fillRect(bx,by,w,h);
  cx.fillStyle=P.boardFrameDark;cx.fillRect(bx,by+h,w,4);
  [P.markerBlue,P.stickyGreen,P.errorGlow,P.markerPurple].forEach((c,i)=>{
    cx.fillStyle=c;cx.fillRect(bx+8+i*12,by+h+1,8,2);
  });
  const sway=Math.sin(t/ANIM.stickyNoteSway)*0.5;
  [{nx:8,ny:5,c:P.stickyYellow},{nx:25,ny:8,c:P.stickyPink},{nx:45,ny:5,c:P.stickyBlue},{nx:18,ny:25,c:P.stickyGreen}].forEach(n=>{
    cx.save();cx.translate(bx+n.nx+5,by+n.ny);cx.rotate(sway*0.02+(n.nx%3-1)*0.05);
    cx.fillStyle=n.c;cx.fillRect(-5,0,12,12);
    cx.fillStyle='rgba(0,0,0,0.2)';cx.fillRect(-3,4,8,1);cx.fillRect(-3,7,6,1);
    cx.restore();
  });
  if(mode==='thinking'){
    cx.strokeStyle=P.markerBlue;cx.lineWidth=1;
    cx.strokeRect(bx+12,by+18,14,10);cx.strokeRect(bx+42,by+18,14,10);cx.strokeRect(bx+27,by+32,14,10);
    cx.beginPath();cx.moveTo(bx+26,by+28);cx.lineTo(bx+34,by+32);cx.moveTo(bx+42,by+28);cx.lineTo(bx+34,by+32);cx.stroke();
    cx.fillStyle='rgba(128,90,213,'+(0.5+Math.sin(t/300)*0.5)+')';cx.font='10px monospace';cx.fillText('?',bx+58,by+42);
  }
  cx.globalAlpha=1;
}

function drawServerRack(t){
  const {x,y,width:w,height:h}=STATIONS.serverRack;
  cx.fillStyle=P.shadow;cx.fillRect(x+2,y+2,w,h);
  cx.fillStyle=P.serverDark;cx.fillRect(x,y,w,h);
  cx.fillStyle=P.serverMid;cx.fillRect(x+2,y+2,w-4,h-4);
  for(let i=0;i<5;i++){
    const uy=y+4+i*11;
    cx.fillStyle=P.serverDark;cx.fillRect(x+3,uy,w-6,9);
    cx.fillStyle=P.serverLight;cx.fillRect(x+4,uy+1,w-8,7);
    cx.fillStyle=P.serverDark;
    for(let v=0;v<2;v++){cx.fillRect(x+6+v*8,uy+3,5,1);cx.fillRect(x+6+v*8,uy+5,5,1);}
    for(let led=0;led<2;led++){
      let lc=P.serverLEDOff;
      if(mode==='running'){const sp=Math.floor(t/ANIM.ledScan)%10;if(sp===i*2+led||sp===i*2+led+1)lc=P.serverLED;}
      else if(mode==='error')lc=Math.floor(t/200)%2===0?P.serverError:P.serverLEDOff;
      else if(mode==='celebrate')lc=P.serverLED;
      else lc=Math.sin(t/1000+i)>0.5?P.serverLED:P.serverLEDOff;
      cx.fillStyle=lc;cx.fillRect(x+w-8,uy+2+led*3,3,2);
    }
  }
  if(mode==='running'){cx.fillStyle='rgba(0,255,136,'+(0.15+Math.sin(t/150)*0.08)+')';cx.beginPath();cx.arc(x+w/2,y+h/2,30,0,Math.PI*2);cx.fill();}
  if(mode==='error'){cx.fillStyle='rgba(245,101,101,'+(0.1+Math.sin(t/100)*0.05)+')';cx.beginPath();cx.arc(x+w/2,y+h/2,30,0,Math.PI*2);cx.fill();}
}

function drawBookshelf(){
  const x=12,y=140,w=22,h=50;
  cx.fillStyle=P.shadowLight;cx.fillRect(x+2,y+2,w,h);
  cx.fillStyle=P.shelfWoodDark;cx.fillRect(x,y,w,h);
  cx.fillStyle=P.shelfWood;cx.fillRect(x+2,y+2,w-4,h-4);
  for(let i=1;i<4;i++){cx.fillStyle=P.shelfWoodDark;cx.fillRect(x+2,y+i*h/4,w-4,2);}
  const bc=[P.bookRed,P.bookBlue,P.bookGreen,P.bookYellow,P.bookPurple];
  for(let s=0;s<4;s++){
    const sy=y+3+s*h/4,sh=h/4-5;let bx=x+3;
    for(let b=0;b<4;b++){const bw=3+(b%2);if(bx+bw>x+w-3)break;cx.fillStyle=bc[(s+b)%5];cx.fillRect(bx,sy,bw,sh);bx+=bw+1;}
  }
}

function drawPlant(t){
  const px=22,py=250;
  cx.fillStyle=P.shadowLight;cx.beginPath();cx.ellipse(px,py+1,8,2,0,0,Math.PI*2);cx.fill();
  cx.fillStyle=P.potTerracotta;cx.fillRect(px-6,py-12,12,12);
  cx.fillStyle=P.potTerracottaDark;cx.fillRect(px-8,py-14,16,3);
  const sway=Math.sin(t/ANIM.plantSway)*(mode==='running'?2:1),droop=mode==='error'?2:0;
  cx.fillStyle=P.leafGreenDark;cx.fillRect(px-1,py-22,2,10);
  [{ox:-8,oy:-24,rx:6,ry:2.5},{ox:8,oy:-22,rx:6,ry:2.5},{ox:0,oy:-28,rx:5,ry:2.5}].forEach(l=>{
    cx.fillStyle=P.leafGreen;cx.beginPath();cx.ellipse(px+l.ox+sway*0.5,py+l.oy+droop,l.rx,l.ry,0,0,Math.PI*2);cx.fill();
    cx.fillStyle=P.leafHighlight;cx.beginPath();cx.ellipse(px+l.ox+sway*0.5-2,py+l.oy+droop-1,l.rx*0.4,l.ry*0.4,0,0,Math.PI*2);cx.fill();
  });
}

function drawDesk(t){
  const dx=STATIONS.desk.x,dy=STATIONS.desk.y,dw=70,dh=20;
  cx.fillStyle=P.shadowLight;cx.fillRect(dx-dw/2+3,dy+3,dw,dh);
  cx.fillStyle=P.deskLight;cx.fillRect(dx-dw/2,dy-2,dw,4);
  cx.fillStyle=P.deskHighlight;cx.fillRect(dx-dw/2,dy-2,dw,1);
  cx.fillStyle=P.deskMid;cx.fillRect(dx-dw/2,dy+2,dw,dh-2);
  cx.fillStyle=P.deskDark;cx.fillRect(dx-dw/2,dy+dh-2,dw,2);
  cx.strokeStyle=P.deskDark;cx.lineWidth=1;cx.strokeRect(dx-15,dy+5,30,10);
  cx.fillStyle=P.deskDark;cx.fillRect(dx-3,dy+9,6,2);
  // Monitor
  const mx=dx,my=dy-28,mw=30,mh=22;
  cx.fillStyle=P.monitorFrame;cx.fillRect(mx-mw/2-2,my-2,mw+4,mh+4);
  cx.fillStyle=P.monitorScreen;cx.fillRect(mx-mw/2,my,mw,mh);
  if(mode==='typing'||mode==='idle'){
    cx.fillStyle=P.screenGlow;
    [5,12,16,9,14,6,11].forEach((lw,i,a)=>{
      const an=mode==='typing'&&i===a.length-1;
      cx.fillRect(mx-mw/2+2,my+2+i*3,an?lw*(0.5+Math.sin(t/150)*0.5):lw,2);
    });
    if(mode==='typing'&&Math.floor(t/300)%2===0){cx.fillStyle='#fff';cx.fillRect(mx-mw/2+2+11,my+2+18,2,2);}
  }else if(mode==='running'){
    cx.fillStyle=P.screenGlow;const o=Math.floor(t/80)%6;
    for(let i=0;i<6;i++)cx.fillRect(mx-mw/2+2,my+2+((i+o)%6)*3,8+((i*7)%12),2);
  }else if(mode==='celebrate'){
    cx.strokeStyle=P.screenGlow;cx.lineWidth=2;cx.beginPath();cx.moveTo(mx-9,my+12);cx.lineTo(mx-3,my+18);cx.lineTo(mx+11,my+5);cx.stroke();
  }else if(mode==='error'){
    cx.strokeStyle=P.errorGlow;cx.lineWidth=2;cx.beginPath();cx.moveTo(mx-9,my+5);cx.lineTo(mx+9,my+18);cx.moveTo(mx+9,my+5);cx.lineTo(mx-9,my+18);cx.stroke();
  }else if(mode==='thinking'){
    cx.fillStyle=P.screenGlowDim;cx.fillRect(mx-mw/2,my,mw,mh);
    cx.fillStyle=P.screenGlow;const df=Math.floor(t/400)%4;
    for(let i=0;i<3;i++)if(i<df)cx.fillRect(mx-6+i*5,my+10,3,3);
  }
  cx.fillStyle=P.monitorFrame;cx.fillRect(mx-4,my+mh+2,8,4);cx.fillRect(mx-8,my+mh+5,16,2);
  // Keyboard
  cx.fillStyle=P.chairMid;cx.fillRect(dx-14,dy-4,28,6);
  cx.fillStyle=P.chairDark;const tk=mode==='typing'?Math.floor(t/ANIM.typing)%25:-1;let ki=0;
  [[-12,-10,-8,-6,-4,-2,0,2,4,6,8,10],[-11,-9,-7,-5,-3,-1,1,3,5,7,9],[-10,-8,-6,-4,-2,0,2,4,6,8]].forEach((r,ri)=>{
    r.forEach(kx=>{cx.fillRect(dx+kx,dy-3+ri*1.8+(ki===tk?0.5:0),1.5,1);ki++;});
  });
  // Mug
  cx.fillStyle=P.mugBody;cx.fillRect(dx+24,dy-6,8,7);
  cx.strokeStyle=P.mugBody;cx.lineWidth=1.5;cx.beginPath();cx.arc(dx+33,dy-3,3,-Math.PI/2,Math.PI/2);cx.stroke();
  cx.fillStyle=P.coffeeDark;cx.fillRect(dx+25,dy-5,6,2);
  cx.strokeStyle=P.steam;cx.lineWidth=1;
  for(let i=0;i<2;i++){const so=(t/ANIM.steamRise+i*4)%8;cx.beginPath();cx.moveTo(dx+27+i*2,dy-6-so);cx.quadraticCurveTo(dx+27+i*2+Math.sin(t/300+i)*1.5,dy-10-so,dx+27+i*2,dy-14-so);cx.stroke();}
  // Papers
  cx.fillStyle=P.paper;cx.fillRect(dx-28,dy-5,8,10);
  cx.fillStyle=P.stickyYellow;cx.fillRect(dx-26,dy-3,5,5);
}

function drawSofa(){
  const sx=STATIONS.lounge.sofaX,sy=STATIONS.lounge.y;
  cx.fillStyle=P.shadowLight;cx.fillRect(sx,sy+14,36,4);
  cx.fillStyle=P.sofaDark;cx.fillRect(sx-2,sy-2,36,10);
  cx.fillStyle=P.sofaMid;cx.fillRect(sx-2,sy-2,36,3);cx.fillRect(sx-4,sy+8,40,8);
  cx.fillStyle=P.sofaDark;cx.fillRect(sx+11,sy+9,1,6);cx.fillRect(sx+23,sy+9,1,6);
  cx.fillStyle=P.sofaLight;cx.fillRect(sx-6,sy+3,4,13);cx.fillRect(sx+34,sy+3,4,13);
  cx.fillStyle=P.chairDark;cx.fillRect(sx,sy+16,3,4);cx.fillRect(sx+31,sy+16,3,4);
}

function drawCoffeeMachine(t){
  const mx=STATIONS.lounge.sofaX+44,my=STATIONS.lounge.y-5;
  cx.fillStyle=P.machineDark;cx.fillRect(mx,my,16,22);
  cx.fillStyle=P.machineMid;cx.fillRect(mx+2,my+2,12,12);
  cx.fillStyle=P.monitorScreen;cx.fillRect(mx+3,my+3,10,5);
  cx.fillStyle=mode==='celebrate'?P.screenGlow:P.serverLEDOff;cx.fillRect(mx+4,my+4,2,2);
  cx.fillStyle=P.machineMid;cx.fillRect(mx+4,my+10,3,2);cx.fillRect(mx+9,my+10,3,2);
  cx.fillStyle=P.machineDark;cx.fillRect(mx+4,my+14,8,6);
  cx.fillStyle=P.mugBody;cx.fillRect(mx+5,my+16,5,4);
  if(mode==='celebrate'){
    cx.strokeStyle=P.steam;cx.lineWidth=1;
    for(let i=0;i<2;i++){const sy=my+12-(t/150+i*5)%8;cx.beginPath();cx.moveTo(mx+7+i*2,sy+4);cx.quadraticCurveTo(mx+7+i*2+Math.sin(t/200)*2,sy,mx+7+i*2,sy-4);cx.stroke();}
  }
}

function drawGong(t){
  const gx=STATIONS.lounge.gongX,gy=STATIONS.lounge.y;
  cx.fillStyle=P.gongStand;
  cx.fillRect(gx-8,gy+14,16,3);cx.fillRect(gx-6,gy-4,3,18);cx.fillRect(gx+3,gy-4,3,18);cx.fillRect(gx-7,gy-6,14,3);
  const ro=mode==='celebrate'?Math.sin(t/ANIM.gongRing)*2:0;
  cx.fillStyle=P.gongGoldDark;cx.beginPath();cx.arc(gx+ro*0.5,gy+5,8,0,Math.PI*2);cx.fill();
  cx.fillStyle=P.gongGold;cx.beginPath();cx.arc(gx+ro,gy+4,7,0,Math.PI*2);cx.fill();
  cx.fillStyle=P.gongGoldLight;cx.beginPath();cx.arc(gx-2+ro,gy+2,3,0,Math.PI*2);cx.fill();
  if(mode==='celebrate'){
    for(let i=0;i<3;i++){
      const ra=(t/200+i*0.5)%2,rr=10+ra*8,al=Math.max(0,0.4-ra*0.2);
      cx.strokeStyle='rgba(214,158,46,'+al+')';cx.lineWidth=1;cx.beginPath();cx.arc(gx,gy+4,rr,0,Math.PI*2);cx.stroke();
    }
  }
}

function drawWastebasket(t){
  const wx=IW-28,wy=248;
  cx.fillStyle=P.basketDark;cx.fillRect(wx-5,wy,10,10);
  cx.fillStyle=P.basketMid;cx.fillRect(wx-6,wy-1,12,2);
  if(mode==='error'){
    [{ox:-2,oy:-4},{ox:2,oy:-6},{ox:0,oy:-8}].forEach((p,i)=>{
      const wb=Math.sin(t/200+i)*0.5;
      cx.fillStyle=i%2===0?P.paper:P.paperCrumpled;
      cx.beginPath();cx.arc(wx+p.ox+wb,wy+p.oy,3,0,Math.PI*2);cx.fill();
    });
  }
}

function drawChar(t){
  const x=charX,y=charY,af=Math.floor(t/200)%4;
  let bo=0,ao=0,lo=0;
  const tgt=getTarget(),walk=Math.abs(tgt.x-x)>2||Math.abs(tgt.y-y)>2;
  if(walk){lo=Math.sin(t/ANIM.walkCycle)*3;ao=Math.sin(t/ANIM.walkCycle+Math.PI)*2;}
  else if(mode==='typing'){ao=af%2===0?-1:1;}
  else if(mode==='running'){bo=Math.sin(t/300);}
  else if(mode==='thinking'){ao=-3;}
  else if(mode==='celebrate'){bo=-Math.abs(Math.sin(t/150)*4);ao=-5;}
  else if(mode==='error'){bo=af%2;ao=af%2===0?2:-2;}
  const by=y+bo;
  // Shadow
  cx.fillStyle=P.shadow;cx.beginPath();cx.ellipse(x,y+2,7,2.5,0,0,Math.PI*2);cx.fill();
  // Legs
  cx.fillStyle=P.pantsDark;
  cx.fillRect(x-3,by-10,3,9+Math.abs(lo/2));cx.fillRect(x,by-10,3,9-Math.abs(lo/2));
  // Shoes
  cx.fillStyle=P.shoes;
  cx.fillRect(x-4,by-1+(lo>0?lo/2:0),4,2);cx.fillRect(x,by-1+(lo<0?-lo/2:0),4,2);
  // Body
  cx.fillStyle=P.shirtBlue;cx.fillRect(x-4,by-19,9,10);
  cx.fillStyle=P.shirtBlueDark;cx.fillRect(x-4,by-19,2,10);
  // Arms
  cx.fillStyle=P.shirtBlue;
  cx.fillRect(x-7,by-17+ao,3,7);cx.fillRect(x+4,by-17+(mode==='thinking'?0:ao),3,7);
  // Hands
  cx.fillStyle=P.skin;
  cx.fillRect(x-7,by-10+ao,3,2);cx.fillRect(x+4,by-10+(mode==='thinking'?-4:ao),3,2);
  // Head
  cx.fillRect(x-4,by-27,9,8);
  // Hair
  cx.fillStyle=P.hair;cx.fillRect(x-5,by-29,10,3);cx.fillRect(x-5,by-27,2,2);cx.fillRect(x+4,by-27,2,2);
  // Eyes
  cx.fillStyle='#1a202c';const bl=Math.floor(t/ANIM.blink)%10;
  if(bl!==0){cx.fillRect(x-2,by-24,2,2);cx.fillRect(x+1,by-24,2,2);}
  else{cx.fillRect(x-2,by-23,2,1);cx.fillRect(x+1,by-23,2,1);}
  // Mouth
  if(mode==='celebrate'){cx.fillStyle='#c53030';cx.fillRect(x-1,by-21,3,1);cx.fillRect(x,by-20,1,1);}
  else if(mode==='error'){cx.fillStyle='#c53030';cx.fillRect(x,by-20,1,1);cx.fillRect(x-1,by-21,1,1);cx.fillRect(x+1,by-21,1,1);}
  else{cx.fillStyle='#8b6b5a';cx.fillRect(x-1,by-21,2,1);}
  // Mode effects
  if(mode==='typing'&&!walk){
    const df=Math.floor(t/120)%4;
    for(let i=0;i<3;i++){cx.fillStyle=i<df?P.screenGlow:'rgba(0,255,136,0.3)';cx.fillRect(x+10+i*4,by-23,2,2);}
  }else if(mode==='thinking'&&!walk){
    cx.fillStyle='rgba(255,255,255,0.9)';cx.beginPath();cx.arc(x+15,by-36,8,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(x+8,by-29,3,0,Math.PI*2);cx.fill();cx.beginPath();cx.arc(x+5,by-26,1.5,0,Math.PI*2);cx.fill();
    cx.fillStyle=P.markerPurple;cx.font='bold 7px monospace';cx.fillText(['?','...','!'][Math.floor(t/400)%3],x+11,by-34);
  }else if(mode==='celebrate'&&!walk){
    cx.fillStyle=P.celebrateGlow;
    const sy=by-36-Math.sin(t/200)*3;
    [[-7,0,4],[0,-4,5],[7,0,4]].forEach(([ox,oy,sz])=>{cx.fillRect(x+ox-sz/2,sy+oy-1,sz,2);cx.fillRect(x+ox-1,sy+oy-sz/2,2,sz);});
  }else if(mode==='error'&&!walk){
    cx.fillStyle=P.errorGlow;cx.fillRect(x-1,by-42,3,7);cx.fillRect(x-1,by-33,3,2);
    cx.fillStyle='#90cdf4';cx.beginPath();cx.moveTo(x+7,by-26);cx.lineTo(x+9,by-22);cx.lineTo(x+5,by-22);cx.closePath();cx.fill();
  }else if(mode==='running'&&!walk){
    cx.strokeStyle='rgba(237,137,54,0.5)';cx.lineWidth=1;
    for(let i=0;i<3;i++){cx.beginPath();cx.moveTo(x-13-i*2,by-23+i*4);cx.lineTo(x-7,by-23+i*4);cx.stroke();}
  }
}

function drawLighting(t){
  if(mode==='running'){cx.fillStyle='rgba(255,180,100,'+(0.08+Math.sin(t/200)*0.03)+')';cx.fillRect(0,0,IW,IH);}
  else if(mode==='error'){cx.fillStyle='rgba(245,101,101,'+(0.06+Math.sin(t/150)*0.03)+')';cx.fillRect(0,0,IW,IH);}
  else if(mode==='celebrate'){cx.fillStyle='rgba(246,224,94,'+(0.05+Math.sin(t/100)*0.02)+')';cx.fillRect(0,0,IW,IH);}
  else if(mode==='thinking'){cx.fillStyle='rgba(100,150,255,0.04)';cx.fillRect(0,0,IW,IH);}
  if(mode!=='thinking'){cx.fillStyle='rgba(0,0,0,0.15)';cx.fillRect(0,50,IW,90);}
}

function drawConfetti(t){
  for(let i=0;i<20;i++){
    const seed=i*137.5,x=(seed+t/20)%IW,y=((seed*2.3+t/ANIM.confetti)%(IH+20))-10;
    const r=(t/100+seed)%(Math.PI*2),sz=2+(i%3);
    cx.save();cx.translate(x,y);cx.rotate(r);cx.fillStyle=P.confetti[i%6];cx.fillRect(-sz/2,-sz/4,sz,sz/2);cx.restore();
  }
}

function drawVignette(){
  const g=cx.createRadialGradient(IW/2,IH/2,IH*0.25,IW/2,IH/2,IH*0.65);
  g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.35)');
  cx.fillStyle=g;cx.fillRect(0,0,IW,IH);
}

function drawStatus(){
  const mc={idle:'#4a5568',typing:'#48bb78',running:'#ed8936',thinking:'#805ad5',celebrate:'#f6e05e',error:'#f56565'};
  const mn={idle:'IDLE',typing:'CODE',running:'RUN',thinking:'READ',celebrate:'DONE',error:'OOPS'};
  cx.fillStyle='rgba(6,21,34,0.85)';cx.fillRect(4,IH-14,40,10);
  cx.fillStyle='rgba(255,255,255,0.3)';cx.fillRect(4,IH-14,40,1);cx.fillRect(4,IH-5,40,1);cx.fillRect(4,IH-14,1,10);cx.fillRect(43,IH-14,1,10);
  cx.fillStyle=mc[mode];cx.fillRect(6,IH-11,4,4);
  cx.fillStyle='#f2c14e';cx.font='5px monospace';cx.fillText(mn[mode],12,IH-7);
}

function render(t){
  cx.fillStyle=P.wallDark;cx.fillRect(0,0,IW,IH);
  drawSkyWindow(t);drawWalls();drawCeilingLights(t);drawSign();drawPoster();
  drawWhiteboard(t);drawServerRack(t);drawBookshelf();drawPlant(t);drawDesk(t);
  drawFloor();drawSofa();drawCoffeeMachine(t);drawGong(t);drawWastebasket(t);
  const tgt=getTarget();updateChar(tgt);drawChar(t);
  drawLighting(t);if(mode==='celebrate')drawConfetti(t);drawVignette();drawStatus();
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
