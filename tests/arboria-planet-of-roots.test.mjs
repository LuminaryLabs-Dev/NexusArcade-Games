import test from 'node:test';
import assert from 'node:assert/strict';
import { createArboriaGame, generatePlanet } from '../prototypes/arboria-planet-of-roots/src/core.mjs';

const snap = game => game.snapshot();
const firstUnlockedLand = s => s.cells.find(c => c.unlocked && !c.isWater);
const adjacentLocked = s => s.cells.find(c => !c.unlocked && c.neighbors.some(id => s.cells[id].unlocked));
const nonAdjacentLocked = s => s.cells.find(c => !c.unlocked && !c.neighbors.some(id => s.cells[id].unlocked));
const nextPlantable = s => s.cells.find(c => c.unlocked && !c.isWater && c.treeId === null);
const frontier = s => s.cells.filter(c => !c.unlocked && c.neighbors.some(id => s.cells[id].unlocked));

test('planet topology is deterministic and dense', () => {
  const a = generatePlanet(76123), b = generatePlanet(76123);
  assert.equal(a.cells.length, 642);
  assert.equal(a.startingCells.length, 3);
  assert.deepEqual(a.startingCells, b.startingCells);
  assert.deepEqual(a.cells.map(c => [c.isWater,c.neighbors]), b.cells.map(c => [c.isWater,c.neighbors]));
  assert.ok(a.landCount > 300 && a.landCount < 500);
  assert.ok(a.cells.every(c => c.neighbors.length === 5 || c.neighbors.length === 6));
});

test('start, claim, plant, water and rain preserve the source rules', () => {
  const game = createArboriaGame({seed:76123}); game.start();
  let s = snap(game);
  assert.equal(s.energy, 120); assert.equal(s.unlockedCount, 3); assert.equal(s.trees.length, 0); assert.equal(s.vitality, 0);
  const far = nonAdjacentLocked(s); game.select(far.id); assert.equal(game.action('claim',{cellId:far.id}), false); assert.equal(snap(game).energy,120);
  s = snap(game); const edge = adjacentLocked(s); game.select(edge.id); assert.equal(game.action('claim',{cellId:edge.id}), true); assert.equal(snap(game).energy,105); assert.equal(snap(game).unlockedCount,4);
  s = snap(game); const land = firstUnlockedLand(s); game.select(land.id); assert.equal(game.action('plant',{cellId:land.id,species:'oak'}), true); assert.equal(snap(game).energy,85); assert.equal(snap(game).trees.length,1); assert.ok(snap(game).vitality>0);
  assert.equal(game.action('plant',{cellId:land.id,species:'oak'}), false); assert.equal(snap(game).trees.length,1);
  const beforeWater=snap(game).energy; assert.equal(game.action('water',{cellId:land.id}),true); assert.equal(snap(game).energy,beforeWater+4);
  const beforeRain=snap(game).energy; assert.equal(game.action('rain'),true); assert.equal(snap(game).energy,beforeRain-50); assert.equal(snap(game).raining,true); game.step(18.01); assert.equal(snap(game).raining,false);
});

test('species selection accepts direct multi-step cycling', () => {
  const g=createArboriaGame();g.start();g.action('cycle-species',{direction:3});assert.equal(snap(g).selectedSpeciesId,'willow');g.action('cycle-species',{direction:-2});assert.equal(snap(g).selectedSpeciesId,'pine');
});

test('three trees complete tier one and pay the mission reward', () => {
  const game=createArboriaGame({seed:76123}); game.start();
  for(let i=0;i<3;i++){const s=snap(game), cell=nextPlantable(s); assert.ok(cell); assert.equal(game.action('plant',{cellId:cell.id,species:'oak'}),true);}
  const s=snap(game); assert.equal(s.trees.length,3); assert.equal(s.missionIndex,1); assert.equal(s.energy,140); assert.ok(s.events.some(e=>e.type==='mission'));
});

test('tree yield is deterministic and uses the 3.5 second cadence', () => {
  const game=createArboriaGame({seed:76123}); game.start(); const cell=nextPlantable(snap(game)); game.action('plant',{cellId:cell.id,species:'oak'}); const before=snap(game).energy; game.step(3.49); assert.equal(Math.floor(snap(game).energy),Math.floor(before)); game.step(.02); assert.equal(Math.floor(snap(game).energy),Math.floor(before+1));
});

test('replay and reset are deterministic', () => {
  const run=()=>{const g=createArboriaGame({seed:8128});g.start();let s=snap(g);let c=nextPlantable(s);g.action('plant',{cellId:c.id,species:'oak'});s=snap(g);c=adjacentLocked(s);g.action('claim',{cellId:c.id});g.step(7);return snap(g)};
  const a=run(),b=run();
  assert.deepEqual({energy:a.energy,score:a.score,vitality:a.vitality,missionIndex:a.missionIndex,trees:a.trees,cells:a.cells.map(c=>[c.unlocked,c.restoration,c.treeId])},{energy:b.energy,score:b.score,vitality:b.vitality,missionIndex:b.missionIndex,trees:b.trees,cells:b.cells.map(c=>[c.unlocked,c.restoration,c.treeId])});
  const g=createArboriaGame({seed:8128});g.start();g.step(4);g.reset();const s=snap(g);assert.equal(s.mode,'title');assert.equal(s.elapsed,0);assert.equal(s.energy,120);assert.equal(s.unlockedCount,3);
});

test('timeout ends the five-minute run', () => { const g=createArboriaGame();g.start();g.step(300.1);const s=snap(g);assert.equal(s.mode,'result');assert.equal(s.resultReason,'timeout');assert.equal(s.remaining,0);assert.ok(s.score>0); });


test('domain ablation proves the authoritative systems are causal', () => {
  {
    const g=createArboriaGame({freeze:['territory']});g.start();const c=adjacentLocked(snap(g));assert.equal(g.action('claim',{cellId:c.id}),false);assert.equal(snap(g).unlockedCount,3);
  }
  {
    const g=createArboriaGame({freeze:['resource']});g.start();const c=nextPlantable(snap(g));assert.equal(g.action('plant',{cellId:c.id,species:'oak'}),false);assert.equal(snap(g).trees.length,0);assert.equal(snap(g).energy,120);
  }
  {
    const g=createArboriaGame({freeze:['vegetation']});g.start();const c=nextPlantable(snap(g));assert.equal(g.action('plant',{cellId:c.id,species:'oak'}),false);assert.equal(snap(g).trees.length,0);
  }
  {
    const g=createArboriaGame({freeze:['weather']});g.start();assert.equal(g.action('rain'),false);assert.equal(snap(g).raining,false);assert.equal(snap(g).energy,120);
  }
  {
    const g=createArboriaGame({freeze:['restoration']});g.start();const c=nextPlantable(snap(g));assert.equal(g.action('plant',{cellId:c.id,species:'oak'}),true);assert.equal(snap(g).vitality,0);
  }
  {
    const g=createArboriaGame({freeze:['objectives']});g.start();for(let i=0;i<3;i++){const c=nextPlantable(snap(g));g.action('plant',{cellId:c.id,species:'oak'});}assert.equal(snap(g).missionIndex,0);assert.equal(snap(g).energy,60);
  }
});

function ensureEnergy(game, amount) { let guard=0; while(snap(game).energy<amount && snap(game).mode==='play' && guard++<200){game.step(3.5);} }
function claimLandUntil(game,count){let guard=0;while(snap(game).unlockedCount<count&&snap(game).mode==='play'&&guard++<500){let s=snap(game),choices=frontier(s).sort((a,b)=>Number(a.isWater)-Number(b.isWater)||a.id-b.id);if(!choices.length)break;ensureEnergy(game,15);game.action('claim',{cellId:choices[0].id});}}
function plantUntil(game,count){let guard=0;while(snap(game).trees.length<count&&snap(game).mode==='play'&&guard++<500){let s=snap(game),cell=nextPlantable(s);if(!cell){claimLandUntil(game,s.unlockedCount+1);continue;}ensureEnergy(game,20);game.action('plant',{cellId:cell.id,species:'oak'});}}

test('a deterministic strategy can reach all six missions inside the arcade window', () => {
  const g=createArboriaGame({seed:76123});g.start();
  plantUntil(g,3); claimLandUntil(g,10); plantUntil(g,12); claimLandUntil(g,25); plantUntil(g,35);
  let guard=0;while(snap(g).mode==='play'&&snap(g).vitality<60&&guard++<300){const s=snap(g),cell=s.cells.find(c=>c.unlocked&&!c.isWater&&c.restoration<1);if(cell)g.action('water',{cellId:cell.id});if(snap(g).energy>=50&&!snap(g).raining)g.action('rain');g.step(.25);}
  const s=snap(g);assert.equal(s.resultReason,'mastery',`mastery not reached: ${JSON.stringify({elapsed:s.elapsed,mission:s.missionIndex,vitality:s.vitality,energy:s.energy,trees:s.trees.length,territory:s.unlockedCount})}`);assert.ok(s.elapsed<300);assert.ok(s.score>10000);
});
