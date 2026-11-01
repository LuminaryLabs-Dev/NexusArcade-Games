// DOM emulation + native Canvas inspection. This is NOT a browser acceptance test.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { Window } = require('happy-dom');
const { createCanvas } = require('@napi-rs/canvas');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.resolve(process.argv[2] || path.join(root,'evidence'));
await mkdir(evidence,{recursive:true});
const window = new Window({url:'http://localhost/switchyard/'});
window.document.write((await readFile(path.join(root,'source/index.html'),'utf8')).replace(/<script[^>]*>.*?<\/script>/gs,''));
const canvas = window.document.getElementById('game-canvas');
const native = createCanvas(1200,720);
canvas.getContext = () => native.getContext('2d');
for (const key of ['width','height']) Object.defineProperty(canvas,key,{get:()=>native[key],set:v=>{native[key]=v;}});
let viewport={width:1200,height:720,left:0,top:0};
canvas.parentElement.getBoundingClientRect = canvas.getBoundingClientRect = () => viewport;
Object.defineProperty(window,'devicePixelRatio',{value:1,configurable:true});
let hidden=false;
Object.defineProperty(window.document,'hidden',{get:()=>hidden});
let nextFrame=1;const frames=new Map();
Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,matchMedia:window.matchMedia.bind(window),requestAnimationFrame:fn=>{const id=nextFrame++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
const {mountSwitchyard}=await import('../source/src/app.mjs');
let app=window.switchyard;
assert.equal(frames.size,1);
const click=id=>document.getElementById(id).click();
click('btn-play-standard');assert.equal(app.sim.state,'PLAYING');
window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'b',bubbles:true}));app.runtime.step();assert.equal(app.sim.switchB.state,1);
click('btn-sig-n');app.runtime.step();assert.equal(app.sim.signalN.isGreen,false);
click('btn-pause');assert.equal(app.sim.state,'PAUSED');const before=app.sim.waveTimer;app.runtime.advance(.1);assert.equal(app.sim.waveTimer,before);
click('btn-resume');assert.equal(app.sim.state,'PLAYING');
app.sim.signalN.isGreen=true;for(let i=0;i<480;i++)app.runtime.step();app.renderer.render();app.ui.updateHUD();
await writeFile(path.join(evidence,'switchyard-canvas.png'),native.toBuffer('image/png'));
assert.ok(app.sim.trains.length>0);assert.match(document.getElementById('val-wave').textContent,/1\/10/);
click('btn-pause');click('btn-quit-title');click('btn-start-tutorial');assert.equal(app.sim.state,'TUTORIAL');
hidden=true;document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(app.sim.state,'PAUSED');
hidden=false;document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(app.sim.state,'PAUSED');click('btn-resume');assert.equal(app.sim.state,'TUTORIAL');
for(const [width,height,dpr] of [[390,640,2],[1280,720,1],[720,1200,1]]){
 viewport={width,height,left:0,top:0};Object.defineProperty(window,'devicePixelRatio',{value:dpr,configurable:true});app.renderer.resize();app.renderer.render();
 assert.ok(Number.isFinite(app.renderer.scale)&&app.renderer.scale>0);const origin=app.renderer.screenToWorld(app.renderer.offsetX,app.renderer.offsetY);assert.ok(Math.abs(origin.x)<1e-8&&Math.abs(origin.y)<1e-8);
}
// Compare authored rendering, allowing only the reviewed station-label fit repair against the preserved original using the
// same native Canvas adapter and empty title state. This is a pixel parity check,
// not a claim about browser CSS, typography or physical touch.
viewport={width:1200,height:720,left:0,top:0};Object.defineProperty(window,'devicePixelRatio',{value:1,configurable:true});
const oldSource=(await readFile(path.join(root,'reference/original.html'),'utf8')).match(/<script>([\s\S]*?)<\/script>/)[1];
const sandbox={window:{addEventListener(){},devicePixelRatio:1,matchMedia:()=>({matches:false})},document,performance:{now:()=>0},console,Math,localStorage:{getItem:()=>null},setTimeout(){}};
vm.createContext(sandbox);vm.runInContext(oldSource+'\nglobalThis.__original={Renderer2D,GameSimulation};',sandbox);
const {fixture}=await import('../source/src/checks.mjs');const {Renderer2D}=await import('../source/src/renderer.mjs');
const fixtureA=fixture(),fixtureB=fixture();const originalSim=new sandbox.__original.GameSimulation(fixtureA.audio,fixtureA.storage);
const oldCanvas=createCanvas(1200,720),newCanvas=createCanvas(1200,720);
for(const c of [oldCanvas,newCanvas]){c.parentElement={getBoundingClientRect:()=>viewport};c.getBoundingClientRect=()=>viewport;}
const oldRender=new sandbox.__original.Renderer2D(oldCanvas,originalSim),newRender=new Renderer2D(newCanvas,fixtureB.sim);oldRender.resize();newRender.resize();oldRender.render();newRender.render();
const oldPixels=oldCanvas.getContext('2d').getImageData(0,0,1200,720).data,newPixels=newCanvas.getContext('2d').getImageData(0,0,1200,720).data;
let changedPixels=0;
for(let i=0;i<oldPixels.length;i+=4){
 if(oldPixels.slice(i,i+4).every((v,j)=>v===newPixels[i+j]))continue;
 const x=(i/4)%1200,y=Math.floor(i/4/1200);
 assert.ok(x>=1070&&x<1200&&[130,290,430,590].some(c=>Math.abs(y-c)<=22),'Unexpected visual change outside station label rows');
 changedPixels++;
}
assert.ok(changedPixels>0,'Station label fit repair must produce a real visible difference');
await writeFile(path.join(evidence,'original-empty-yard.png'),oldCanvas.toBuffer('image/png'));
await writeFile(path.join(evidence,'converted-empty-yard.png'),newCanvas.toBuffer('image/png'));
for(let i=0;i<10;i++){app=mountSwitchyard();assert.equal(frames.size,1);}
app.dispose();assert.equal(frames.size,0);const state=app.sim.state;click('btn-play-standard');assert.equal(app.sim.state,state);
const report={method:'Happy DOM + native Canvas, not Chromium',checks:['start','keyboard dispatch via Engine','signal button','pause/resume','train simulation and HUD','tutorial hidden-tab pause and explicit resume','three viewport/DPR projections','original/converted parity outside intentional station-label fit repair','ten mounts retain one loop','dispose removes input and frame'],passed:10,browserAcceptance:'NOT RUN',physicalMobile:'NOT RUN',cssLayout:'NOT RUN'};
await writeFile(path.join(evidence,'host-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
await window.happyDOM.abort();window.close();
