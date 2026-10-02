const TAU = Math.PI * 2;
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
function rotate([x,y,z], yaw, pitch) {
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const x1=x*cy-z*sy, z1=x*sy+z*cy;
  return [x1,y*cp-z1*sp,y*sp+z1*cp];
}
function mix(a,b,t){return Math.round(a+(b-a)*t)}
function colorMix(a,b,t){return `rgb(${mix(a[0],b[0],t)},${mix(a[1],b[1],t)},${mix(a[2],b[2],t)})`}
const LAND=[202,164,92], GREEN=[44,169,87], WATER=[25,151,205], LOCK=[21,30,43];
const SPECIES_COLORS={oak:'#45c46c',pine:'#27734d',cherry:'#ff85ad',willow:'#f5b51b'};

export function createArboriaView(canvas,{onSelect}={}){
  const ctx=canvas.getContext('2d',{alpha:false}), state={yaw:-.25,pitch:-.22,zoom:1,drag:false,lastX:0,lastY:0,startX:0,startY:0,stars:[]};
  for(let i=0;i<170;i++)state.stars.push({x:(i*73%997)/997,y:(i*193%991)/991,r:.4+(i*31%13)/20,a:.2+(i*19%11)/15});
  let projected=[];
  const resize=()=>{const dpr=Math.min(devicePixelRatio||1,2),rect=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0)};
  const project=(normal,w,h)=>{const [x,y,z]=rotate(normal,state.yaw,state.pitch),f=state.zoom*(.88+.18*z),radius=Math.min(w,h)*.335;return {x:w/2+x*radius*f,y:h/2-y*radius*f,z,f,visible:z>-.25}};
  function render(game){
    const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,s=game.snapshot(),night=.5+.5*Math.sin((s.elapsed/72)*TAU-Math.PI/2),bg=night>.54?'#02060b':'#07111a';
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    for(const star of state.stars){ctx.globalAlpha=star.a*(.55+night*.45);ctx.fillStyle='#bde9e2';ctx.beginPath();ctx.arc(star.x*w,star.y*h,star.r,0,TAU);ctx.fill()}ctx.globalAlpha=1;
    const glow=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.min(w,h)*.43);glow.addColorStop(0,'rgba(39,149,173,.42)');glow.addColorStop(.72,'rgba(10,63,90,.20)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(w/2,h/2,Math.min(w,h)*.43,0,TAU);ctx.fill();
    projected=s.cells.map(cell=>({cell,...project(cell.normal,w,h)})).filter(p=>p.visible).sort((a,b)=>a.z-b.z);
    const baseR=Math.min(w,h)*.013*state.zoom;
    for(const p of projected){const c=p.cell,r=baseR*(.82+p.z*.28)*(c.isPentagon?.95:1);let fill=c.unlocked?(c.isWater?`rgb(${WATER.join(',')})`:colorMix(LAND,GREEN,c.restoration)):`rgb(${LOCK.join(',')})`;ctx.fillStyle=fill;ctx.strokeStyle=c.id===s.selectedCell?'#f7ff9d':c.unlocked?'rgba(220,255,235,.20)':'rgba(70,93,112,.24)';ctx.lineWidth=c.id===s.selectedCell?2.5:1;ctx.beginPath();const sides=c.isPentagon?5:6;for(let i=0;i<sides;i++){const a=TAU*i/sides+Math.PI/6,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.stroke();if(c.id===s.selectedCell){ctx.strokeStyle='rgba(247,255,157,.25)';ctx.lineWidth=7;ctx.stroke()}}
    const treeByCell=new Map(s.trees.map(t=>[t.cellId,t]));
    for(const p of projected){const t=treeByCell.get(p.cell.id);if(!t)continue;const size=(3+8*t.growth)*(.8+p.z*.3)*state.zoom;ctx.save();ctx.translate(p.x,p.y-size*.15);ctx.globalAlpha=clamp((p.z+.25)/.35,0,1);ctx.strokeStyle='#5b3c28';ctx.lineWidth=Math.max(1,size*.18);ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(0,-size*.7);ctx.stroke();ctx.fillStyle=SPECIES_COLORS[t.species];if(t.species==='pine'){ctx.beginPath();ctx.moveTo(0,-size*1.55);ctx.lineTo(-size*.7,0);ctx.lineTo(size*.7,0);ctx.closePath();ctx.fill()}else{ctx.beginPath();ctx.arc(0,-size*.9,size*.62,0,TAU);ctx.fill();if(t.species==='cherry'){ctx.fillStyle='#ffd3e1';ctx.beginPath();ctx.arc(size*.3,-size*1.1,size*.18,0,TAU);ctx.fill()}}ctx.restore()}
    if(s.raining){ctx.save();ctx.globalAlpha=.52;ctx.strokeStyle='#73c8ff';ctx.lineWidth=1;for(let i=0;i<130;i++){const a=(i*2.399+s.elapsed*.22)%TAU,rad=(i%17)/17*Math.min(w,h)*.44,rx=w/2+Math.cos(a)*rad,ry=h/2+Math.sin(a)*rad*.72;ctx.beginPath();ctx.moveTo(rx,ry-8);ctx.lineTo(rx-3,ry+7);ctx.stroke()}ctx.restore()}
    const rr=Math.min(w,h)*.34*state.zoom;ctx.strokeStyle='rgba(113,246,190,.24)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(w/2,h/2,rr,0,TAU);ctx.stroke();
  }
  const pick=(x,y)=>{let best=null,bestD=Infinity;for(const p of projected){const d=Math.hypot(p.x-x,p.y-y);if(d<bestD){bestD=d;best=p}}if(best&&bestD<24*state.zoom){onSelect?.(best.cell.id);return best.cell.id}return null};
  canvas.addEventListener('pointerdown',e=>{state.drag=true;state.lastX=e.clientX;state.lastY=e.clientY;state.startX=e.clientX;state.startY=e.clientY;canvas.setPointerCapture?.(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!state.drag)return;const dx=e.clientX-state.lastX,dy=e.clientY-state.lastY;state.lastX=e.clientX;state.lastY=e.clientY;state.yaw+=dx*.008;state.pitch=clamp(state.pitch+dy*.006,-1.15,1.15)});
  canvas.addEventListener('pointerup',e=>{const dx=e.clientX-state.startX,dy=e.clientY-state.startY;state.drag=false;if(Math.hypot(dx,dy)<6){const r=canvas.getBoundingClientRect();pick(e.clientX-r.left,e.clientY-r.top)}});
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=clamp(state.zoom*(e.deltaY>0?.94:1.06),.72,1.34)},{passive:false});
  return {resize,render,pick,rotate(dx,dy){state.yaw+=dx;state.pitch=clamp(state.pitch+dy,-1.15,1.15)},focusCenter(game){const rect=canvas.getBoundingClientRect();let best=null,bestD=Infinity;projected=game.snapshot().cells.map(cell=>({cell,...project(cell.normal,rect.width,rect.height)})).filter(p=>p.visible);for(const p of projected){const d=Math.hypot(p.x-rect.width/2,p.y-rect.height/2);if(d<bestD){bestD=d;best=p}}if(best)onSelect?.(best.cell.id);return best?.cell.id??null}};
}
