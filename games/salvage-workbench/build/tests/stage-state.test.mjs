import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStageAction, createStageState, stepStage, checkpointPosition, isNearFuse } from '../src/stage-state.mjs';

test('retry resets all work-order progress', () => {
  const state = createStageState(); state.scrap = 2; state.fanOn = true;
  const reset = applyStageAction(state, { type: 'retry' });
  assert.equal(reset.scrap, 0); assert.equal(reset.fanOn, false); assert.equal(reset.stage, 'crossing');
});

test('cable swing is bounded and lands beyond the ruler gap', () => {
  const state = createStageState(); state.position.z = 1.2;
  applyStageAction(state, { type: 'swing', nearAnchor: true });
  assert.ok(state.tether);
  for (let i=0; i<60; i++) stepStage(state, {}, 1/60);
  assert.equal(state.tether, null); assert.ok(state.position.z < -3.5); assert.equal(state.grounded, true);
});

test('magnetic recovery requires aim time before fuse installation', () => {
  const state = createStageState(); state.stage = 'fan-mechanism';
  applyStageAction(state, { type: 'retrieve-fuse', aimed: true, dt: 0.7 });
  assert.equal(state.magnetProgress, 0);
  state.position = {x:0.25,y:1.45,z:-10};
  applyStageAction(state, { type: 'retrieve-fuse', aimed: true, dt: 0.7 });
  assert.equal(state.fuse, 'missing');
  applyStageAction(state, { type: 'retrieve-fuse', aimed: true, dt: 0.6 });
  assert.equal(state.fuse, 'recovered'); assert.equal(state.stage, 'install-fuse');
  applyStageAction(state, { type: 'interact', target: 'control' });
  assert.equal(state.fanOn, false);
  applyStageAction(state, { type: 'interact', target: 'control', near: true });
  assert.equal(state.fanOn, true); assert.equal(state.stage, 'glide');
});

test('fall returns to the last completed repair checkpoint', () => {
  const state = createStageState(); state.checkpoint = 'control-shelf'; state.stage = 'glide';
  state.fanOn = true; state.fuse = 'installed'; state.position = { x: 10, y: -3.1, z: 30 };
  stepStage(state, {}, 1/60);
  assert.deepEqual(state.position, checkpointPosition('control-shelf'));
  assert.equal(state.lastCue, 'checkpoint-return');
  assert.equal(state.fanOn, true); assert.equal(state.fuse, 'installed'); assert.equal(state.stage, 'glide');
});

test('riding the fan and landing on the battery shelf clears the stage', () => {
  const state = createStageState(); state.fanOn = true; state.stage = 'glide';
  state.position={x:0,y:1.2,z:-20.8}; state.grounded=false;
  for (let i=0; i<60 && !state.cleared; i++) stepStage(state, {}, 1/60);
  assert.equal(state.cleared, true); assert.equal(state.stage, 'finish');
});

test('a body already beneath a platform is not snapped up through it', () => {
  const state = createStageState(); state.position.y = -0.1; state.velocity.y = -1;
  stepStage(state, {}, 1/60);
  assert.ok(state.position.y < -0.1); assert.equal(state.grounded, false);
});

test('battery completion requires grounded contact on the battery shelf', () => {
  const outside = createStageState(); outside.fanOn=true; outside.stage='glide'; outside.position={x:8,y:0.42,z:-21};
  stepStage(outside, {}, 1/60);
  assert.equal(outside.cleared, false);
  const landed = createStageState(); landed.fanOn=true; landed.stage='glide'; landed.position.z=-20.8;
  stepStage(landed, {}, 1/60);
  assert.equal(landed.cleared, true);
});

test('glide is confined to the repaired fan corridor and fuse retrieval range is bounded', () => {
  const state = createStageState(); state.fanOn=true; state.stage='glide';
  stepStage(state, {glide:true}, 1/60);
  assert.ok(state.position.y <= 0.42);
  state.position.z=-16; state.position.y=0.42; state.velocity.y=0; state.grounded=true;
  stepStage(state, {glide:true}, 1/60);
  assert.ok(state.position.y > 0.42);
  assert.equal(isNearFuse({x:0.25,y:1.45,z:-10}), true);
  assert.equal(isNearFuse({x:0.25,y:1.45,z:-7}), false);
});

test('invalid movement and delta inputs remain finite and bounded', () => {
  const state = createStageState();
  stepStage(state, {x:NaN,z:Infinity}, NaN);
  assert.equal(state.position.x, 0); assert.equal(state.position.z, 9);
  assert.ok(Number.isFinite(state.elapsed)); assert.ok(state.elapsed <= 1/30);
});
