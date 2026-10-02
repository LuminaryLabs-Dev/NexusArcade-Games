import { createArboriaGame } from './core.mjs';
import { createArboriaView } from './view.mjs';

const $=id=>document.getElementById(id), canvas=$('planet');
const STORE='nexus-arcade:arboria-planet-of-roots:records:v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')}catch{}
const game=createArboriaGame({seed:76123,best:saved});
const view=createArboriaView(canvas,{onSelect:id=>{game.select(id);if(game.snapshot().mode==='play')game.action('primary');render()}});
let manual=false,last=performance.now(),toastTimer=0,lastEventCount=0,dragMoved=false,pointerDown=null;
const speciesButtons=[...document.querySelectorAll('[data-species]')];
function persist(){try{localStorage.setItem(STORE,JSON.stringify(game.snapshot().best))}catch{}}
function formatTime(s){const n=Math.max(0,Math.ceil(s));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1600)}
function render(){
  const s=game.snapshot();view.render(game);
  $('time').textContent=formatTime(s.remaining);$('score').textContent=s.score.toLocaleString();$('energy').textContent=Math.floor(s.energy);$('vitality').textContent=`${Math.floor(s.vitality)}%`;$('territory').textContent=s.unlockedCount;$('trees').textContent=s.trees.length;
  const m=s.currentMission;$('missionTier').textContent=m?`Tier ${s.missionIndex+1}`:'Mastery';$('missionText').textContent=m?m.label:'Arboria is fully restored.';$('missionFill').style.width=m?`${Math.min(100,m.current/m.target*100)}%`:'100%';
  const spec=s.species[s.selectedSpecies];$('selectedSpecies').textContent=spec.name;$('selectedCost').textContent=`${spec.cost} ☀`;
  speciesButtons.forEach((b,i)=>b.classList.toggle('active',i===s.selectedSpecies));
  const cell=s.cells[s.selectedCell],target=cell?(cell.unlocked?(cell.isWater?'Ocean cell':cell.treeId!==null?'Occupied grove':'Plantable soil'):(cell.neighbors.some(id=>s.cells[id].unlocked)?'Claimable frontier':'Shrouded frontier')):'—';$('target').textContent=target;
  $('rain').classList.toggle('active',s.raining);$('rain').textContent=s.raining?`RAIN ${Math.ceil(s.rainRemaining)}s`:'CALL RAIN';
  $('titleScreen').hidden=s.mode!=='title';$('pauseScreen').hidden=s.mode!=='pause';$('resultScreen').hidden=s.mode!=='result';$('hud').hidden=s.mode==='title';
  if(s.mode==='result'){$('resultTitle').textContent=s.resultReason==='mastery'?'PLANET RESTORED':'TIME EXPIRED';$('resultScore').textContent=s.score.toLocaleString();$('bestScore').textContent=s.best.score.toLocaleString();$('resultStats').textContent=`${Math.floor(s.vitality)}% vitality · ${s.unlockedCount} territory · ${s.trees.length} trees · ${s.missionIndex}/6 missions`;persist()}
  if(s.events.length!==lastEventCount){const e=s.events.at(-1);lastEventCount=s.events.length;if(e&&e.type!=='start'&&e.type!=='species')toast(e.message)}
}
function start(){game.start();view.focusCenter(game);render()}
function restart(){game.reset();game.start();view.focusCenter(game);lastEventCount=0;render()}
function primary(){if(game.snapshot().mode!=='play')return;game.action('primary');render()}
function water(){if(game.snapshot().mode!=='play')return;game.action('water');render()}
function rain(){if(game.snapshot().mode!=='play')return;game.action('rain');render()}
function cycle(dir=1){game.action('cycle-species',{direction:dir});render()}
function pause(){game.pause();render()}
function rotate(dx,dy){view.rotate(dx,dy);view.focusCenter(game);render()}

$('play').onclick=start;$('resume').onclick=pause;$('restart').onclick=restart;$('resultRestart').onclick=restart;$('primary').onclick=primary;$('water').onclick=water;$('rain').onclick=rain;$('species').onclick=()=>cycle(1);speciesButtons.forEach((b,i)=>b.onclick=()=>{const s=game.snapshot();game.action('cycle-species',{direction:i-s.selectedSpecies});render()});
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.repeat)return;const s=game.snapshot();if(e.code==='Enter'&&s.mode==='title'){start();return}if(e.code==='Enter'&&s.mode==='result'){restart();return}if(e.code==='Escape'){if(['play','pause'].includes(s.mode))pause();return}if(e.code==='KeyR'){restart();return}if(s.mode!=='play')return;if(e.code==='ArrowLeft'||e.code==='KeyA')rotate(-.12,0);if(e.code==='ArrowRight'||e.code==='KeyD')rotate(.12,0);if(e.code==='ArrowUp'||e.code==='KeyW')rotate(0,-.09);if(e.code==='ArrowDown'||e.code==='KeyS')rotate(0,.09);if(['Space','Enter'].includes(e.code))primary();if(e.code==='KeyB')cycle(1);if(e.code==='KeyX')water();if(e.code==='KeyY')rain();if(/^Digit[1-4]$/.test(e.code)){const target=Number(e.code.at(-1))-1,cur=game.snapshot().selectedSpecies;game.action('cycle-species',{direction:target-cur});render()}});
window.addEventListener('blur',()=>{if(game.snapshot().mode==='play'){game.pause();render()}});
window.addEventListener('resize',()=>{view.resize();render()});

let gpPrev={};function pollGamepad(){const gp=navigator.getGamepads?.()[0];if(gp){const ax=gp.axes?.[0]||0,ay=gp.axes?.[1]||0;if(Math.abs(ax)>.35||Math.abs(ay)>.35)rotate(ax*.028,ay*.022);const pressed=i=>!!gp.buttons?.[i]?.pressed,edge=(i,name)=>{const p=pressed(i),was=gpPrev[name];gpPrev[name]=p;return p&&!was};const mode=game.snapshot().mode;if(edge(0,'a')){if(mode==='title'||mode==='result')restart();else primary()}if(edge(1,'b'))cycle(1);if(edge(2,'x'))water();if(edge(3,'y'))rain();if(edge(9,'start'))pause()}requestAnimationFrame(pollGamepad)}requestAnimationFrame(pollGamepad);

function advance(seconds){manual=true;const end=performance.now()+Math.max(0,seconds)*1000;let left=seconds;while(left>1e-9&&game.snapshot().mode==='play'){const dt=Math.min(.05,left);game.step(dt);left-=dt}render();return game.snapshot()}
window.Arboria={
  start, restart, pause, primary, water, rain, cycleSpecies:cycle, select:cellId=>{game.select(cellId);render();return game.snapshot()}, action:(type,payload)=>{const out=game.action(type,payload);render();return out}, advance, snapshot:()=>game.snapshot(), ready:true,
};
view.resize();render();
function frame(now){if(!manual&&game.snapshot().mode==='play'){game.step(Math.min(.1,(now-last)/1000));render()}last=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);
