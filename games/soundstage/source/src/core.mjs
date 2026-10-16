export const SAVE_KEY = 'nexus-soundstage-campaign-v1';
export const TITLES = ['Opening Keys', 'Drumline', 'String Rush', 'Bell Circuit', 'Full Ensemble'];
export const MOTIFS = [[0,4,7,4],[0,2,4,7],[0,5,9,7],[0,7,11,7],[0,4,7,11,7,4]];
export const NOTE_NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export function freshSave() { return { version:1, unlocked:1, records:Array.from({length:5},()=>null) }; }
export function parseSave(raw) {
  try {
    const s=typeof raw==='string'?JSON.parse(raw):raw;
    if(!s || s.version!==1 || !Number.isInteger(s.unlocked) || s.unlocked<1 || s.unlocked>5 || !Array.isArray(s.records) || s.records.length!==5) return freshSave();
    return {version:1,unlocked:s.unlocked,records:s.records.map(r=>r && Number.isFinite(r.score)&&r.score>=0&&Number.isFinite(r.time)&&r.time>0 ? {score:Math.floor(r.score),time:r.time}:null)};
  } catch { return freshSave(); }
}
export function makeLevel(index) {
  if(!Number.isInteger(index)||index<0||index>=5) throw new RangeError('Unknown level');
  const motif=MOTIFS[index], pads=[]; let x=0;
  for(let i=0;i<30;i++) {
    const width=i===0?8:4.6+(i%3)*.65, gap=i===0?0:1.2+(i%3)*.25;
    x+=gap;
    const y=i===0?0:[0,.35,.7,.35][Math.floor(i/3)%4];
    let type='key';
    if(index>=1&&i%6===3) type='drum';
    if(index>=2&&i%6===4) type='string';
    if(index>=3&&i%6===1) type='bell';
    pads.push({id:`pad-${i}`,x,y,width,type,note:motif[i%motif.length],checkpoint:i%6===0});
    x+=width;
  }
  return {index,title:TITLES[index],motif,pads,finish:x-1.5,length:x, collectibles:pads.filter((_,i)=>i%3===2).map((p,i)=>({id:`note-${i}`,x:p.x+p.width*.5,y:p.y+1.65}))};
}
export function newRun(index,assist=false) {
  const level=makeLevel(index);
  return {level,assist,x:1,y:.02,vx:0,vy:0,grounded:true,padId:'pad-0',checkpoint:0,combo:0,bestCombo:0,phrase:0,phraseIndex:0,chainLeft:0,score:0,time:0,falls:0,visited:[],collected:[],completed:false,jumpBuffer:0,coyote:.1,events:[]};
}
export function chainNote(s,pad) {
  if(s.visited.includes(pad.id)) return;
  s.visited.push(pad.id);
  const expected=s.level.motif[s.phraseIndex];
  if(pad.note===expected) {
    s.combo++; s.phraseIndex++;
    if(s.phraseIndex===s.level.motif.length){s.phrase++;s.phraseIndex=0;s.score+=150;s.events.push({type:'phrase'});}
  } else {
    s.combo=pad.note===s.level.motif[0]?1:0;
    s.phraseIndex=s.combo?1:0;
  }
  s.bestCombo=Math.max(s.bestCombo,s.combo);
  s.chainLeft=s.assist?8:4;
  s.score+=50+10*Math.min(s.combo,12);
  s.events.push({type:'note',note:pad.note,instrument:pad.type,combo:s.combo});
}
export function targetSpeed(s) { return 5.8+Math.min(s.combo,12)*.34; }
export function respawn(s) {
  const p=s.level.pads[s.checkpoint];
  s.x=p.x+.8;s.y=p.y+.02;s.vx=0;s.vy=0;s.grounded=true;s.padId=p.id;s.combo=0;s.phraseIndex=0;s.chainLeft=0;s.jumpBuffer=0;s.coyote=.1;s.falls++;
  s.events.push({type:'fall'});
}
export function tick(s,input,delta) {
  s.events=[];
  if(s.completed) return s;
  const dt=Math.max(0,Math.min(Number.isFinite(delta)?delta:0,.025));
  s.time+=dt;
  s.chainLeft=Math.max(0,s.chainLeft-dt);
  if(s.chainLeft===0){s.combo=0;s.phraseIndex=0;}
  if(input.jumpPressed)s.jumpBuffer=.13;else s.jumpBuffer=Math.max(0,s.jumpBuffer-dt);
  s.coyote=s.grounded?.1:Math.max(0,s.coyote-dt);
  const axis=Math.max(-1,Math.min(1,Number.isFinite(input.axis)?input.axis:0));
  const wanted=axis*targetSpeed(s),accel=s.grounded?42:24;
  s.vx+=Math.max(-accel*dt,Math.min(accel*dt,wanted-s.vx));
  if(s.jumpBuffer>0&&s.coyote>0){s.vy=8.5;s.grounded=false;s.jumpBuffer=0;s.coyote=0;s.events.push({type:'jump'});}
  const oldY=s.y;
  s.x=Math.max(.2,s.x+s.vx*dt);s.vy-=20*dt;s.y+=s.vy*dt;
  let landed=null;
  if(s.vy<=0) for(const p of s.level.pads) {
    if(s.x>=p.x-.12&&s.x<=p.x+p.width+.12&&oldY>=p.y-.06&&s.y<=p.y){if(!landed||p.y>landed.y)landed=p;}
  }
  s.grounded=!!landed;
  if(landed){
    s.y=landed.y;s.vy=0;
    const changed=s.padId!==landed.id;s.padId=landed.id;
    if(changed || !s.visited.length)chainNote(s,landed);
    const pi=s.level.pads.indexOf(landed);
    if(landed.checkpoint&&pi>s.checkpoint){s.checkpoint=pi;s.events.push({type:'checkpoint'});}
    if(landed.type==='drum'&&changed){s.vy=10.8;s.grounded=false;s.events.push({type:'bounce'});}
  }
  for(const n of s.level.collectibles) if(!s.collected.includes(n.id)&&Math.hypot(s.x-n.x,s.y+.5-n.y)<.75){s.collected.push(n.id);s.score+=100;s.events.push({type:'collect'});}
  if(s.y<-6)respawn(s);
  if(s.x>=s.level.finish&&s.grounded){s.completed=true;s.score+=Math.max(0,1000-Math.floor(s.time*5)-s.falls*50);s.events.push({type:'complete'});}
  return s;
}
export function completeSave(save,run) {
  if(!run.completed) throw new Error('Unfinished run');
  const s=parseSave(save), i=run.level.index, old=s.records[i];
  s.unlocked=Math.max(s.unlocked,Math.min(5,i+2));
  s.records[i]={score:Math.max(old?.score??0,run.score),time:Math.min(old?.time??Infinity,run.time)};
  return s;
}
