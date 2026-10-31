import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../games/switchyard/source/src/checks.mjs';
import { SIM_DT } from '../games/switchyard/source/src/constants.mjs';

test('All ten authored waves can be dispatched legally with all lives intact', () => {
  const {sim}=fixture();sim.startStandardRun();let selected=null, steps=0, delivered=0, maxTrail=0;
  while(sim.state!=='VICTORY' && steps++<240000){
    if(sim.state==='WAVE_CLEAR'){delivered+=sim.waveDeliveredCount;sim.setupWave(sim.currentWave+1);sim.state='PLAYING';selected=null;}
    if(!selected || selected.isRemoved) selected=sim.trains.find(t=>!t.isRemoved && !t.isCrashed) ?? null;
    // One train through the merge at a time. Toggle only unlocked switches.
    for(const [signal,entrance] of [[sim.signalN,'N'],[sim.signalS,'S']]){
      const go=!!selected && selected.entrance===entrance && selected.stage==='APPROACH';
      if(signal.isGreen!==go) signal.toggle(null);
    }
    if(selected){
      const a=['AMBER','CYAN'].includes(selected.destination.id)?0:1;
      const b=['AMBER','MAGENTA'].includes(selected.destination.id)?0:1;
      for(const [sw,target] of [[sim.switchA,a],[a===0?sim.switchB:sim.switchC,b]]) if(sw.state!==target&&!sw.locked)sw.toggle(null);
    }
    sim.update(SIM_DT);
    assert.equal(sim.lives,3,`life lost in wave ${sim.currentWave}`);
    for(const train of sim.trains)maxTrail=Math.max(maxTrail,train.history.length);
    assert.ok(sim.trains.length<=6);assert.ok(sim.particles.length<=100);
  }
  assert.equal(sim.state,'VICTORY');assert.equal(sim.currentWave,10);
  assert.ok(delivered+sim.waveDeliveredCount>=100);assert.ok(maxTrail<100);
});
