import { GameSimulation, Train, SwitchTrack } from './simulation.mjs';
import { STATIONS, SIM_DT, TRAIN_DIMS } from './constants.mjs';
import { createYardRuntime, YardState, TrainView } from './runtime.mjs';
import { StorageManager } from './storage.mjs';

export function fixture() {
  const audio = new Proxy({}, { get: () => () => {} });
  const storage = { memoryData: { bestScore: 0, bestWave: 1, settings: { reducedMotion: true }, endlessUnlocked: false }, save() {}, updateRecord() {} };
  const sim = new GameSimulation(audio, storage);
  return { sim, audio, storage };
}
function assert(value, message = 'Unexpected result') { if (!value) throw new Error(message); }
function ticks(sim, count) { for (let i = 0; i < count; i++) sim.update(SIM_DT); }
export function runChecks() {
  const results = [];
  function check(name, fn) { try { fn(); results.push({ name, passed: true }); } catch (e) { results.push({ name, passed: false, error: e.message }); } }
  check('Green signal actually releases a train beyond the approach', () => {
    const {sim} = fixture(); sim.state = 'PLAYING'; sim.waveTotalTrains = 99;
    const train = new Train('release', 'N', STATIONS.AMBER, 100); sim.trains = [train];
    ticks(sim, 240); assert(train.stage !== 'APPROACH');
  });
  check('Red signal holds without growing a stationary trail, then releases', () => {
    const {sim} = fixture(); sim.state = 'PLAYING'; sim.waveTotalTrains = 99; sim.signalN.isGreen = false;
    const train = new Train('hold', 'N', STATIONS.AMBER, 100); sim.trains = [train];
    ticks(sim, 1000); const d = train.pathDist, history = train.history.length;
    ticks(sim, 2000); assert(train.pathDist === d && train.history.length === history && history < 100);
    sim.signalN.isGreen = true; ticks(sim, 120); assert(train.stage !== 'APPROACH');
  });
  for (const [id, a, b] of [['AMBER',0,0],['CYAN',0,1],['MAGENTA',1,0],['LIME',1,1]]) {
    check(`A real train reaches ${id} with correct score`, () => {
      const {sim} = fixture(); sim.state = 'PLAYING'; sim.waveTotalTrains = 99;
      sim.switchA.state = a; sim.switchB.state = b; sim.switchC.state = b;
      sim.trains = [new Train(id, 'N', STATIONS[id], 100)];
      ticks(sim, 1200); assert(sim.waveDeliveredCount === 1 && sim.waveResolvedCount === 1 && sim.score === 100 && sim.lives === 3);
    });
  }
  check('Same-entrance queue maintains safe spacing', () => {
    const {sim} = fixture(); sim.state = 'PLAYING'; sim.waveTotalTrains = 99; sim.signalN.isGreen = false;
    const lead = new Train('lead','N',STATIONS.AMBER,100), back = new Train('back','N',STATIONS.AMBER,100);
    lead.pathDist = lead.totalTraveled = 120; sim.trains = [lead, back];
    ticks(sim,600); assert(!lead.isCrashed && !back.isCrashed && lead.pathDist - back.pathDist >= TRAIN_DIMS.carOffset + TRAIN_DIMS.carLength + 15.99);
  });
  check('Switch remains locked until the rear carriage clears', () => {
    const {sim} = fixture(); sim.state = 'PLAYING'; sim.waveTotalTrains = 99;
    const t = new Train('lock','N',STATIONS.AMBER,100); t.stage = 'TRUNK';
    t.pathDist = sim.topology.getPath('TRUNK').length - 49; t.totalTraveled = 400; sim.trains = [t];
    ticks(sim,32); assert(t.stage === 'BRANCH_1' && sim.switchA.locked);
    const old = sim.switchA.state; assert(!sim.switchA.toggle(null)); assert(sim.switchA.state === old);
    ticks(sim,50); assert(!sim.switchA.locked && t.committedBranchA === old);
  });
  check('Locked switch rejects rather than queues a change', () => {
    const sw = new SwitchTrack('A','A',0,0,['UP','DOWN']); sw.locked=true;
    assert(sw.toggle(null) === false && sw.state === 0); sw.locked=false; sw.update(1); assert(sw.state===0);
  });
  check('Delivery is atomic, including fever and turbo bonuses', () => {
    const {sim} = fixture(); sim.state='PLAYING'; sim.streak=5; sim.score=500;
    const t=new Train('delivery','N',STATIONS.AMBER,100); t.committedBranchA=0;t.committedBranchFinal=0;t.isTurbo=true;
    sim.resolveStationArrival(t); const score=sim.score; sim.resolveStationArrival(t);
    assert(score===900 && sim.score===score && sim.waveResolvedCount===1 && sim.streak===6);
  });
  check('Wrong destination costs exactly one life', () => {
    const {sim}=fixture(); sim.state='PLAYING'; const t=new Train('wrong','N',STATIONS.LIME,100);t.committedBranchA=0;t.committedBranchFinal=0;
    sim.resolveStationArrival(t);sim.resolveStationArrival(t);assert(sim.lives===2&&sim.waveResolvedCount===1);
  });
  check('A collision consumes one life and resolves each train once', () => {
    const {sim}=fixture();sim.state='PLAYING';const a=new Train('a','N',STATIONS.AMBER,100),b=new Train('b','S',STATIONS.AMBER,100);
    sim.trains=[a,b];sim.triggerCollision(a,b);sim.triggerCollision(a,b);assert(sim.lives===2&&sim.waveResolvedCount===2);
  });
  check('Terminal game over cannot award another delivery', () => {
    const {sim}=fixture();sim.state='GAME_OVER';const t=new Train('late','N',STATIONS.AMBER,100);t.committedBranchA=0;t.committedBranchFinal=0;
    sim.resolveStationArrival(t);assert(sim.score===0&&sim.waveResolvedCount===0);
  });
  check('Pause freezes movement and scheduled tutorial recovery', () => {
    const {sim}=fixture();sim.startTutorial();sim.tutorialResetTimer=.8;sim.state='PAUSED';ticks(sim,600);
    assert(sim.trains[0].totalTraveled===0&&sim.tutorialResetTimer===.8);
  });
  check('Tutorial progresses through both real station deliveries', () => {
    const {sim}=fixture();sim.startTutorial();sim.switchB.state=0;ticks(sim,1000);assert(sim.tutorialStep===2);
    sim.switchA.state=1;sim.switchC.state=1;ticks(sim,1000);assert(sim.tutorialStep>=3);
  });
  check('Tutorial collision recovery does not leak into a new run', () => {
    const {sim}=fixture();sim.startTutorial();sim.tutorialResetTimer=.8;sim.startStandardRun();ticks(sim,100);
    assert(sim.state==='PLAYING'&&sim.tutorialResetTimer===0);
  });
  check('Twenty restarts preserve clean game state', () => {
    const {sim}=fixture();for(let i=0;i<20;i++){sim.startStandardRun();ticks(sim,120);}sim.startStandardRun();
    assert(sim.score===0&&sim.lives===3&&sim.trains.length===0&&sim.switchA.reservations.size===0);
  });
  check('All particle producers share the same bounded pool', () => {
    const {sim}=fixture();for(let i=0;i<300;i++){sim.spawnStationCelebration(STATIONS.AMBER);sim.spawnIncidentSparks(0,0);sim.spawnSteam(0,0);sim.spawnBrakeSpark(0,0);sim.spawnFloatingText('x',0,0,'white');}
    assert(sim.particles.length<=100&&sim.floatingScores.length<=32);
  });
  check('Wave ten unlocks endless without changing the authored mode', () => {
    const {sim,storage}=fixture();sim.state='PLAYING';sim.currentWave=10;sim.completeWave();assert(sim.state==='VICTORY'&&storage.memoryData.endlessUnlocked);
    sim.startEndlessRun();assert(sim.currentWave===11&&sim.isEndless&&sim.waveTotalTrains<=20);
  });
  check('Nexus Engine owns command ordering and committed observation', () => {
    const {sim}=fixture();sim.state='PLAYING';sim.waveTotalTrains=99;const r=createYardRuntime(sim);
    r.bindAction('signal',()=>sim.signalN.toggle(null));r.send('signal');assert(sim.signalN.isGreen);
    r.step();assert(!sim.signalN.isGreen&&r.engine.world.getResource(YardState).state==='PLAYING');
    assert(r.engine.getLastTickCommit().committed===true);r.step();assert(!sim.signalN.isGreen);r.dispose();
  });
  check('Nexus entity observations are removed on restart and disposal', () => {
    const {sim}=fixture();sim.state='PLAYING';sim.waveTotalTrains=99;sim.trains=[new Train('entity','N',STATIONS.AMBER,100)];
    const r=createYardRuntime(sim);r.step();assert(r.engine.world.query(TrainView).length===1);
    sim.startStandardRun();r.step();assert(r.engine.world.query(TrainView).length===0);r.dispose();assert(r.engine.world.entityCount===0);
  });
  check('Long host stalls have a five-tick budget, not catch-up spirals', () => {
    const {sim}=fixture();const r=createYardRuntime(sim);assert(r.advance(3600)===5);assert(r.advance(0)===0);r.dispose();assert(r.advance(1)===0);
  });
  check('Malformed settings cannot replace required defaults', () => {
    const store = new StorageManager({getItem: () => '{"settings":null,"bestScore":"bad"}'});
    assert(store.memoryData.settings.volume===70&&store.memoryData.bestScore===0);
  });
  check('Complete tutorial reaches title with the completion record', () => {
    const {sim,storage}=fixture();sim.startTutorial();sim.switchB.state=0;
    for(let i=0;sim.tutorialStep===1 && i<2000;i++) sim.update(SIM_DT);
    sim.switchA.state=1;sim.switchC.state=1;
    for(let i=0;sim.tutorialStep===2 && i<2000;i++) sim.update(SIM_DT);
    sim.signalS.isGreen=false;
    let count=0;
    while(sim.tutorialStep===3 && count++<2000) sim.update(SIM_DT);
    assert(sim.tutorialStep===4);
    // Wait for the full north consist to clear before releasing the south train.
    ticks(sim,100);sim.signalS.isGreen=true;ticks(sim,1600);
    assert(sim.state==='TITLE' && storage.memoryData.tutorialCompleted===true);
  });
  check('Denied or corrupt persistence stays usable in memory', () => {
    const store = new StorageManager({getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}});
    store.updateRecord(100,2);assert(store.memoryData.bestScore===100);
    const malformed = new StorageManager({getItem:()=>'{broken'});assert(malformed.memoryData.bestScore===0);
  });
  check('No approach-only close-call points are farmed before clearance', () => {
    const {sim}=fixture();sim.state='PLAYING';const a=new Train('a','N',STATIONS.AMBER,100),b=new Train('b','S',STATIONS.AMBER,100);
    a.stage=b.stage='MERGE';a.locoPos={x:395,y:330};b.locoPos={x:395,y:390};a.carPos={x:350,y:300};b.carPos={x:350,y:420};sim.trains=[a,b];
    sim.checkConflictsAndCollisions();assert(sim.score===0);
  });
  check('Restart current wave restores its score/lives checkpoint', () => {
    const {sim}=fixture();sim.startStandardRun();sim.score=250;sim.lives=2;sim.streak=4;sim.restartWave();
    assert(sim.score===0&&sim.lives===3&&sim.streak===0&&sim.currentWave===1);
  });
  check('Wave completion bonus cannot be applied twice', () => {
    const {sim}=fixture();sim.startStandardRun();sim.completeWave();const score=sim.score;sim.completeWave();assert(sim.score===score);
  });
  return results;
}
