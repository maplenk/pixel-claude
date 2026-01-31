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
  sk:'#ffd9b3',hr:'#4a3728',sr:'#667eea',pn:'#2d3748',so:'#1a202c'
};

// Characters
const chars=[
  {x:90,y:150,c:{sk:'#ffd9b3',hr:'#4a3728',sr:'#667eea'}},
  {x:170,y:150,c:{sk:'#e8beac',hr:'#1a1a2e',sr:'#48bb78'}},
  {x:90,y:210,c:{sk:'#ffecd2',hr:'#c53030',sr:'#ed8936'}},
  {x:170,y:210,c:{sk:'#d4a574',hr:'#1a1a2e',sr:'#f56565'}},
];
let mx=chars[0].x,my=chars[0].y+20,tx=mx,ty=my;

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

function floor(t){
  cx.fillStyle=P.fl;cx.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=20)for(let x=0;x<W;x+=20){
    cx.fillStyle=((x/20+y/20)%2)?P.fl:P.fl2;
    cx.fillRect(x,y,20,20);
    cx.strokeStyle=P.fll;cx.lineWidth=.5;cx.strokeRect(x,y,20,20);
  }
}

function walls(){
  // Top wall
  cx.fillStyle=P.wl;cx.fillRect(0,0,W,60);
  cx.fillStyle=P.wl2;cx.fillRect(0,55,W,8);

  // Wall trim
  cx.fillStyle='#b8a5cc';cx.fillRect(0,60,W,3);
}

function sign(){
  const sw=CO.length*10+20,sx=W-sw-20,sy=15;
  cx.fillStyle=P.sg;cx.fillRect(sx,sy,sw,28);
  cx.strokeStyle=P.sgt;cx.lineWidth=2;cx.strokeRect(sx,sy,sw,28);
  cx.fillStyle=P.sgt;cx.font='bold 14px monospace';cx.fillText(CO,sx+10,sy+19);
}

function windows(t){
  // Window 1
  const wx=W-80,wy=10;
  cx.fillStyle=P.wnf;cx.fillRect(wx-3,wy-3,46,46);
  const g=cx.createLinearGradient(wx,wy,wx,wy+40);
  g.addColorStop(0,'#a8d8ea');g.addColorStop(1,'#87ceeb');
  cx.fillStyle=g;cx.fillRect(wx,wy,40,40);
  cx.strokeStyle=P.wnf;cx.lineWidth=2;
  cx.beginPath();cx.moveTo(wx+20,wy);cx.lineTo(wx+20,wy+40);cx.moveTo(wx,wy+20);cx.lineTo(wx+40,wy+20);cx.stroke();

  // Clouds
  cx.fillStyle='rgba(255,255,255,0.7)';
  const cx1=wx+10+Math.sin(t/2000)*5;
  cx.beginPath();cx.arc(cx1,wy+12,4,0,Math.PI*2);cx.arc(cx1+6,wy+10,5,0,Math.PI*2);cx.arc(cx1+12,wy+12,4,0,Math.PI*2);cx.fill();
}

function shelf(){
  const sx=20,sy=15;
  // Shelf boards
  cx.fillStyle=P.sh;
  cx.fillRect(sx,sy,60,5);cx.fillRect(sx,sy+25,60,5);
  cx.fillStyle=P.shd;
  cx.fillRect(sx,sy+5,3,20);cx.fillRect(sx+57,sy+5,3,20);

  // Books
  const books=[[5,P.bk1,12],[18,P.bk2,10],[30,P.bk3,8],[40,P.bk4,11],[52,P.bk5,9]];
  books.forEach(([bx,c,h])=>{cx.fillStyle=c;cx.fillRect(sx+bx,sy+5+(20-h),6,h)});

  // Lower shelf items
  cx.fillStyle=P.bk2;cx.fillRect(sx+5,sy+30,8,15);
  cx.fillStyle=P.bk4;cx.fillRect(sx+15,sy+35,12,10);
  cx.fillStyle=P.pl;cx.beginPath();cx.arc(sx+45,sy+38,6,0,Math.PI*2);cx.fill();
  cx.fillStyle=P.pt;cx.fillRect(sx+41,sy+42,8,5);
}

function desk(x,y,i,t){
  // Chair
  cx.fillStyle=P.chd;cx.fillRect(x-8,y+15,16,8);
  cx.fillStyle=P.ch;cx.fillRect(x-10,y,20,18);

  // Desk
  cx.fillStyle=P.dkd;cx.fillRect(x-25,y-8,50,5);
  cx.fillStyle=P.dk;cx.fillRect(x-25,y-3,50,12);
  cx.fillStyle=P.dkt;cx.fillRect(x-25,y-10,50,4);

  // Monitor
  cx.fillStyle=P.mn;cx.fillRect(x-10,y-28,20,16);
  cx.fillStyle=P.ms;cx.fillRect(x-8,y-26,16,12);

  // Screen glow based on mode
  if(mode==='typing'&&i===0){
    cx.fillStyle='rgba(0,255,136,0.15)';cx.fillRect(x-8,y-26,16,12);
    cx.fillStyle=P.mg;
    for(let l=0;l<4;l++)cx.fillRect(x-6,y-24+l*3,8+Math.sin(t/200+l)*3,2);
    if(Math.floor(t/300)%2)cx.fillRect(x+4,y-24+9,2,2);
  }else if(mode==='running'&&i===0){
    cx.fillStyle='rgba(0,255,136,'+(.1+Math.sin(t/100)*.05)+')';cx.fillRect(x-8,y-26,16,12);
    cx.fillStyle=P.mg;
    const o=Math.floor(t/80)%4;
    for(let l=0;l<3;l++)cx.fillRect(x-6,y-24+((l+o)%4)*3,6+(l*3)%10,2);
  }else{
    cx.fillStyle=P.mg;cx.fillRect(x-6,y-24,3,2);cx.fillRect(x-2,y-24,6,2);
    if(Math.floor(t/600)%2)cx.fillRect(x-6,y-20,3,2);
  }

  // Monitor stand
  cx.fillStyle=P.mn;cx.fillRect(x-3,y-12,6,4);cx.fillRect(x-6,y-9,12,2);

  // Keyboard
  cx.fillStyle='#4a5568';cx.fillRect(x-8,y-5,16,4);
}

function lounge(){
  const lx=W-120,ly=H-90;

  // Rug
  cx.fillStyle=P.rg;cx.fillRect(lx-20,ly+20,100,50);
  cx.fillStyle=P.rgd;cx.strokeStyle=P.rgd;cx.lineWidth=2;cx.strokeRect(lx-18,ly+22,96,46);

  // Couch
  cx.fillStyle=P.sfd;cx.fillRect(lx,ly,70,25);
  cx.fillStyle=P.sf;cx.fillRect(lx,ly-5,70,10);cx.fillRect(lx-5,ly,10,30);cx.fillRect(lx+65,ly,10,30);

  // Cushions
  cx.fillStyle='#7c3aed';cx.fillRect(lx+8,ly+2,18,15);cx.fillRect(lx+44,ly+2,18,15);

  // Coffee table
  cx.fillStyle=P.dkt;cx.fillRect(lx+15,ly+35,40,20);
  cx.fillStyle=P.dk;cx.fillRect(lx+15,ly+33,40,4);

  // Items on table
  cx.fillStyle='#fff';cx.fillRect(lx+20,ly+38,12,8);
  cx.fillStyle=P.bk2;cx.fillRect(lx+35,ly+40,10,6);
}

function plant(x,y,s=1){
  // Pot
  cx.fillStyle=P.pt;cx.fillRect(x-6*s,y-10*s,12*s,10*s);
  cx.fillStyle=P.ptd;cx.fillRect(x-7*s,y-12*s,14*s,3*s);
  // Leaves
  cx.fillStyle=P.pl;
  cx.beginPath();cx.ellipse(x-5*s,y-18*s,4*s,6*s,-.3,0,Math.PI*2);cx.fill();
  cx.beginPath();cx.ellipse(x+5*s,y-16*s,4*s,6*s,.3,0,Math.PI*2);cx.fill();
  cx.beginPath();cx.ellipse(x,y-22*s,3*s,6*s,0,0,Math.PI*2);cx.fill();
  cx.fillStyle=P.pld;cx.fillRect(x-1*s,y-16*s,2*s,6*s);
}

function worker(x,y,c,isMain,t){
  const anim=Math.floor(t/200)%4;
  let bob=0,arm=0;

  if(isMain){
    if(mode==='typing'){arm=anim%2?-1:1;bob=anim%2?-1:0;}
    else if(mode==='running'){bob=Math.sin(anim*Math.PI/2)*2;}
    else if(mode==='celebrate'){bob=-anim;arm=-3-anim;}
    else if(mode==='error'){bob=anim%2;}
  }

  const by=y+bob;

  // Shadow
  cx.fillStyle='rgba(0,0,0,0.1)';cx.beginPath();cx.ellipse(x,y+2,6,2,0,0,Math.PI*2);cx.fill();

  // Legs
  cx.fillStyle=P.pn;cx.fillRect(x-3,by-8,2,6);cx.fillRect(x+1,by-8,2,6);

  // Body
  cx.fillStyle=c.sr;cx.fillRect(x-4,by-16,8,10);

  // Arms
  cx.fillRect(x-6,by-14+arm,2,6);cx.fillRect(x+4,by-14+arm,2,6);

  // Hands
  cx.fillStyle=c.sk;cx.fillRect(x-6,by-8+arm,2,2);cx.fillRect(x+4,by-8+arm,2,2);

  // Head
  cx.fillRect(x-4,by-24,8,8);

  // Hair
  cx.fillStyle=c.hr;cx.fillRect(x-5,by-26,10,4);cx.fillRect(x-5,by-24,2,2);cx.fillRect(x+3,by-24,2,2);

  // Eyes
  cx.fillStyle='#1a202c';
  if(Math.floor(t/2500)%8!==0){cx.fillRect(x-2,by-22,1,2);cx.fillRect(x+1,by-22,1,2);}

  // Effects for main character
  if(isMain){
    if(mode==='typing'){
      const df=Math.floor(t/150)%3;
      for(let i=0;i<3;i++){cx.fillStyle=i===df?P.mg:'rgba(0,255,136,0.3)';cx.fillRect(x+10+i*3,by-20,2,2);}
    }else if(mode==='thinking'){
      cx.fillStyle='rgba(255,255,255,0.9)';
      cx.beginPath();cx.arc(x+14,by-32,7,0,Math.PI*2);cx.fill();
      cx.beginPath();cx.arc(x+8,by-26,3,0,Math.PI*2);cx.fill();
      cx.fillStyle='#805ad5';cx.font='bold 7px monospace';cx.fillText(['?','..','!'][Math.floor(t/500)%3],x+11,by-30);
    }else if(mode==='celebrate'){
      const cols=[P.bk4,P.pl,P.bk1,'#00d9ff'];
      for(let i=0;i<6;i++){
        const a=(i*Math.PI*2)/6+t/400,d=12+Math.sin(t/150+i)*4;
        cx.fillStyle=cols[i%4];cx.fillRect(x+Math.cos(a)*d-1,by-16+Math.sin(a)*d-1,3,3);
      }
    }else if(mode==='error'){
      cx.fillStyle='#f56565';cx.fillRect(x-1,by-38,3,6);cx.fillRect(x-1,by-30,3,2);
    }
  }
}

function render(t){
  floor(t);
  walls();
  windows(t);
  sign();
  shelf();

  // Plants
  plant(250,H-50);
  plant(W-30,H-40,.8);
  plant(120,58,.7);

  lounge();

  // Desks and workers
  chars.forEach((ch,i)=>{
    desk(ch.x,ch.y,i,t);
    worker(ch.x,ch.y+20,ch.c,i===0,t);
  });

  // Main character position update
  if(mode==='thinking'){tx=200;ty=H-60;}
  else if(mode==='running'){tx=W-100;ty=H-50;}
  else{tx=chars[0].x;ty=chars[0].y+20;}

  const dx=tx-mx,dy=ty-my,dist=Math.sqrt(dx*dx+dy*dy);
  if(dist>1){mx+=dx/dist*1.2;my+=dy/dist*1.2;}

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
