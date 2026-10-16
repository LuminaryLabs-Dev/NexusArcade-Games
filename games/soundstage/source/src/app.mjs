import {SAVE_KEY,TITLES,NOTE_NAMES,freshSave,parseSave,newRun,tick,targetSpeed,completeSave} from './core.mjs';
import {authorUnitCube} from './authoring.mjs';
const $=id=>document.getElementById(id),keys=new Set();
let THREE,renderer,scene,camera,engine,unit,run=null,paused=true,raf=0,last=0,accumulator=0,jump=false,audio,master,objects=[],player,save=freshSave(),ready=false,noticeUntil=0;
const resources=new Set(),stageGroupHolder={group:null};
try{save=parseSave(localStorage.getItem(SAVE_KEY));}catch{$('storage').textContent='Storage unavailable. Progress lasts only for this session.';}
$('motion').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
const announce=text=>{$('notice').textContent=text;noticeUntil=performance.now()+2800;};
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch{$('storage').textContent='Could not save. Keep this tab open to retain progress.';}}
function sound(note,type='key',strength=.35){
  if(!audio||audio.state!=='running')return;
  const o=audio.createOscillator(),g=audio.createGain();o.type=type==='bell'?'sine':type==='string'?'triangle':type==='drum'?'sine':'triangle';
  o.frequency.setValueAtTime(261.63*2**(note/12),audio.currentTime);
  if(type==='drum')o.frequency.exponentialRampToValueAtTime(65,audio.currentTime+.13);
  g.gain.setValueAtTime(0,audio.currentTime);g.gain.linearRampToValueAtTime(strength,audio.currentTime+.015);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.45);
  o.connect(g);g.connect(master);o.start();o.stop(audio.currentTime+.48);o.onended=()=>{o.disconnect();g.disconnect();};
}
function enableAudio(){try{if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.connect(audio.destination);}master.gain.value=Number($('volume').value);audio.resume().catch(()=>{});}catch{announce('Audio unavailable. Visual notes remain active.');}}
$('volume').oninput=()=>{if(master)master.gain.value=Number($('volume').value);};
function showLevels(){
  $('levels').replaceChildren();
  TITLES.forEach((title,i)=>{const b=document.createElement('button');b.disabled=!ready||i>=save.unlocked;b.textContent=`${i+1}. ${title}${i>=save.unlocked?' · Locked':''}`;const r=save.records[i];if(r){const s=document.createElement('span');s.textContent=`${r.score} pts · ${r.time.toFixed(1)}s`;b.append(s);}b.onclick=()=>start(i);$('levels').append(b);});
}
function menu(){paused=true;keys.clear();jump=false;accumulator=0;$('panel').hidden=false;$('resume').hidden=!run||run.completed;$('panel').querySelector('button:not(:disabled)')?.focus();showLevels();}
function material(color,emissive=0){const m=new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.25,emissive,emissiveIntensity:.4});resources.add(m);return m;}
function box(parent,x,y,z,w,h,d,color){const m=new THREE.Mesh(unit,material(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=false;parent.add(m);return m;}
function clearStage(){if(stageGroupHolder.group)scene.remove(stageGroupHolder.group);for(const r of resources)r.dispose();resources.clear();objects=[];}
function buildStage(){
  clearStage();const group=new THREE.Group();stageGroupHolder.group=group;scene.add(group);
  const colors={key:0xf0dfbd,drum:0xe7765a,string:0x6ee0c0,bell:0xffc852};
  for(const p of run.level.pads){
    const m=box(group,p.x+p.width/2,p.y-.28,0,p.width,.55,3,colors[p.type]);objects.push({kind:'pad',mesh:m,p});
    box(group,p.x+p.width/2,p.y-.8,0,.25,1,2,0x3a4561);
    if(p.type==='key'){for(let j=1;j<4;j++)box(group,p.x+p.width*j/4,p.y+.04,-.7,.25,.12,1.4,0x18202e);}
    if(p.type==='string'){for(let j=0;j<4;j++)box(group,p.x+p.width/2,p.y+.04,-.7+j*.45,p.width,.05,.04,0xffdf96);}
    if(p.type==='bell')box(group,p.x+p.width/2,p.y+3,-1.1,.07,3.5,.07,0xffc852);
    if(p.checkpoint)box(group,p.x+.25,p.y+.4,-1.6,.12,.8,.12,0x64ead2);
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#152031';ctx.font='bold 38px monospace';ctx.textAlign='center';ctx.fillText(NOTE_NAMES[p.note],64,45);
    const texture=new THREE.CanvasTexture(canvas);resources.add(texture);const sm=new THREE.SpriteMaterial({map:texture,transparent:true});resources.add(sm);const label=new THREE.Sprite(sm);label.position.set(p.x+p.width/2,p.y+.35,1.15);label.scale.set(1,.5,1);group.add(label);
  }
  for(const n of run.level.collectibles){const m=box(group,n.x,n.y,0,.3,.4,.3,0x64ead2);objects.push({kind:'collect',mesh:m,n});}
  box(group,run.level.finish+1,2,0,.15,4,3.4,0xffce63);
  player=new THREE.Group();box(player,0,.48,0,.55,.65,.5,0x69d9e4);box(player,0,.95,0,.65,.35,.55,0xf9eee0);box(player,.17,.97,.3,.14,.12,.03,0x12202e);group.add(player);
  box(group,run.level.length/2,-7,-4,run.level.length+20,.6,30,0x222c42);
}
function start(index){$('panel').querySelector('h1').textContent='Soundstage';if(!ready||index>=save.unlocked)return;enableAudio();run=newRun(index,$('assist').checked);buildStage();paused=false;keys.clear();jump=false;accumulator=0;$('panel').hidden=true;$('world').tabIndex=0;$('world').focus();$('hud').hidden=false;$('stage').textContent=`${index+1} / 5 · ${run.level.title}`;announce('Follow the phrase. Space to jump between instruments.');}
function resume(){if(!run||run.completed)return;enableAudio();paused=false;accumulator=0;$('panel').hidden=true;$('world').focus();}
$('resume').onclick=resume;$('menuButton').onclick=menu;$('retryLoad').onclick=()=>location.reload();
function inputDown(event){if(['INPUT','BUTTON'].includes(event.target?.tagName)&&event.code!=='Escape')return;if(['Space','ArrowLeft','ArrowRight','ArrowUp'].includes(event.code))event.preventDefault();if(event.code==='Escape'){if(paused)resume();else menu();return;}if(!keys.has(event.code)&&['Space','ArrowUp','KeyW'].includes(event.code))jump=true;keys.add(event.code);}
function inputUp(event){keys.delete(event.code);}
document.addEventListener('keydown',inputDown);document.addEventListener('keyup',inputUp);
for(const b of document.querySelectorAll('[data-control]')){const code={left:'ArrowLeft',right:'ArrowRight',jump:'Space'}[b.dataset.control];b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(code);if(code==='Space')jump=true;enableAudio();};const release=()=>keys.delete(code);b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;}
function blur(){keys.clear();jump=false;if(run&&!paused)menu();}
window.addEventListener('blur',blur);document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();});
function update(dt){
  const axis=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);
  tick(run,{axis,jumpPressed:jump},dt);jump=false;
  for(const e of run.events){if(e.type==='note')sound(e.note,e.instrument);if(e.type==='collect')sound(12,'bell',.2);if(e.type==='phrase')announce(`Phrase complete! Chain ${run.combo}`);if(e.type==='checkpoint')announce('Checkpoint reached');if(e.type==='fall')announce('Back at checkpoint. Collected notes kept.');if(e.type==='complete'){save=completeSave(save,run);persist();$('panel').querySelector('h1').textContent=run.level.index===4?'Campaign complete':'Stage complete';menu();announce(`${run.score} points · Best chain ${run.bestCombo}`);}}
  $('score').textContent=String(run.score);$('clock').textContent=`${Math.floor(run.time/60)}:${String(Math.floor(run.time%60)).padStart(2,'0')}`;$('chain').textContent=`Chain ${run.combo} · Speed ×${(targetSpeed(run)/5.8).toFixed(2)}`;
  $('phrase').textContent=run.level.motif.map((n,i)=>`${i===run.phraseIndex?'[':''}${NOTE_NAMES[n]}${i===run.phraseIndex?']':''}`).join(' ');$('timer').max=run.assist?8:4;$('timer').value=run.chainLeft;
}
function frame(now){raf=requestAnimationFrame(frame);const elapsed=Math.min((now-last)/1000,.1);last=now;
  if(run&&!paused){accumulator+=elapsed;while(accumulator>=1/120){update(1/120);accumulator-=1/120;if(paused){accumulator=0;break;}}}
  if(run){player.position.set(run.x,run.y,0);player.rotation.z=$('motion').checked?0:-run.vx*.018;for(const o of objects){if(o.kind==='collect'){o.mesh.visible=!run.collected.includes(o.n.id);if(!$('motion').checked)o.mesh.rotation.y=now*.001;}else{o.mesh.position.y=o.p.y-.28-(run.padId===o.p.id&&run.grounded&&o.p.type==='key'?.07:0);}}
    const target=new THREE.Vector3(run.x+3,run.y+6,11);camera.position.lerp(target,$('motion').checked?1:.09);camera.lookAt(run.x+3,run.y+.8,0);
  }else{camera.position.set(5,6,12);camera.lookAt(5,0,0);}
  if(now>noticeUntil&&ready&&run&&!paused)$('notice').textContent='';renderer.render(scene,camera);
}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
async function boot(){try{
  const [three,core,author]=await Promise.all([import('./three-runtime.mjs'),import('./engine-runtime.mjs'),import('./engine-runtime.mjs')]);THREE=three;
  engine=core.createEngine({kits:author.createAuthoringDomain()});const authored=authorUnitCube(engine);unit=new THREE.BufferGeometry();unit.setAttribute('position',new THREE.Float32BufferAttribute(authored.positions,3));unit.computeVertexNormals();
  renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x101522);scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xcde7ff,0x362329,2));const light=new THREE.DirectionalLight(0xffe6bd,3);light.position.set(2,9,6);scene.add(light);camera=new THREE.PerspectiveCamera(48,1,.1,180);resize();window.addEventListener('resize',resize);ready=true;showLevels();$('stage').textContent='Campaign · Five stages';announce('Choose your first stage');last=performance.now();raf=requestAnimationFrame(frame);
}catch(error){console.error(error);$('stage').textContent='Loading failed';$('notice').textContent='Could not load the engine or graphics. Check your connection and retry.';$('retryLoad').hidden=false;}}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);document.removeEventListener('keydown',inputDown);document.removeEventListener('keyup',inputUp);clearStage();unit?.dispose();renderer?.dispose();audio?.close().catch(()=>{});},{once:true});
showLevels();boot();

window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
