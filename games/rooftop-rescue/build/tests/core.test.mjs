import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPACITY, PAD_X, SHIFT_SECONDS, SITES, finishSave, freshSave, newFlight, parseSave, remaining, tick } from '../src/core.mjs';

test('powered climb uses fuel while a forward glide preserves it', () => {
  const glide = newFlight(); glide.landedAt = null; glide.x = 40; glide.y = 34; glide.vx = 14; glide.vy = 0;
  tick(glide, { axis: 0, climb: false, descend: false }, .05);
  assert.equal(glide.glide, true); assert.equal(glide.fuel, 100);
  const powered = newFlight(); powered.landedAt = null; powered.x = 40; powered.y = 34; powered.vx = 14; powered.vy = 0;
  tick(powered, { axis: 0, climb: true, descend: false }, .05);
  assert.ok(powered.fuel < 100); assert.ok(powered.vy > glide.vy);
});

test('a landed aircraft rescues people over time and respects cabin capacity', () => {
  const s = newFlight(); s.x = SITES[0].x; s.y = SITES[0].roof; s.landedAt = SITES[0].id;
  for (let i = 0; i < 23; i++) tick(s, { rescue: true }, .05);
  assert.equal(s.rescued.west, 1); assert.equal(s.passengers, 1);
  for (let i = 0; i < 23; i++) tick(s, { rescue: true }, .05);
  assert.equal(s.rescued.west, 2); assert.equal(s.passengers, 2);
  s.rescued.market = 0; s.landedAt = 'market'; s.x = SITES[1].x;
  for (let i = 0; i < 23; i++) tick(s, { rescue: true }, .05);
  assert.equal(s.passengers, CAPACITY); assert.equal(s.rescued.market, 1);
  for (let i = 0; i < 30; i++) tick(s, { rescue: true }, .05);
  assert.equal(s.rescued.market, 1); assert.equal(s.passengers, CAPACITY);
});

test('landing at evacuation pad unloads, scores, repairs, and refuels', () => {
  const s = newFlight(); s.passengers = 2; s.fuel = 20; s.hull = 50; s.landedAt = null; s.x = PAD_X; s.y = 24.05; s.vy = -3; s.vx = 2;
  tick(s, { axis: 0 }, .05);
  assert.equal(s.landedAt, 'pad'); assert.equal(s.passengers, 0); assert.equal(s.delivered, 2);
  assert.equal(s.fuel, 46); assert.equal(s.hull, 68); assert.equal(s.score, 500);
});

test('a high-speed rooftop landing damages the aircraft rather than teleporting to safety', () => {
  const s = newFlight(); s.landedAt = null; s.x = SITES[0].x; s.y = SITES[0].roof + .2; s.vx = 19; s.vy = -5;
  tick(s, { axis: 0 }, .05);
  assert.equal(s.landedAt, null); assert.ok(s.hull < 100); assert.ok(s.events.some((event) => event.type === 'impact'));
});

test('a gentle horizontal arrival still gets damaged by a vertical slam', () => {
  const s = newFlight(); s.landedAt = null; s.x = PAD_X; s.y = 24.1; s.vx = 2; s.vy = -12;
  tick(s, { axis: 0 }, .05);
  assert.equal(s.landedAt, null); assert.ok(s.hull < 100); assert.ok(s.events.some((event) => event.type === 'impact'));
});

test('five-minute shift ends cleanly and completed flights update a safe record', () => {
  const s = newFlight(); s.time = SHIFT_SECONDS - .025; s.state = 'playing'; tick(s, {}, .05);
  assert.equal(s.state, 'over'); assert.throws(() => finishSave(freshSave(), newFlight()), /still active/);
  s.state = 'won'; s.delivered = 8; s.score = 1800;
  assert.deepEqual(finishSave({ version: 1, bestDelivered: 5, bestScore: 1200, bestTime: 240 }, s), { version: 1, bestDelivered: 8, bestScore: 1800, bestTime: 240 });
});

test('corrupted saves fall back and waiting people are counted deterministically', () => {
  assert.deepEqual(parseSave('{bad'), freshSave()); assert.deepEqual(parseSave({ version: 1, bestDelivered: -1, bestScore: 0, bestTime: null }), freshSave());
  const s = newFlight(); s.rescued.west = 1; s.rescued.hotel = 2;
  assert.equal(remaining(s), SITES.reduce((n, site) => n + site.people, 0) - 3);
});

// A control-driven route: no teleports or direct state edits after newFlight.
test('continuous flight controls rescue and deliver all ten people', () => {
  const s = newFlight(); let target = SITES[0], index = 0;
  for (let frame = 0; frame < 18000 && s.state === 'playing'; frame++) {
    if (s.landedAt === target.id) {
      if (target.id === 'pad') { index++; if(index === SITES.length) break; target = SITES[index]; }
      else if(s.rescued[target.id] === target.people) target = {id:'pad',x:PAD_X,roof:24};
      else { tick(s,{rescue:true},1/60); continue; }
    }
    const dx = target.x-s.x, close = Math.abs(dx)<3 && Math.abs(s.vx)<3;
    const altitude = close ? target.roof-1 : Math.max(target.roof+8,48);
    const wanted = Math.max(-4,Math.min(7,(altitude-s.y)*.9));
    const axis = Math.abs(dx)<1 && Math.abs(s.vx)<1 ? 0 : Math.sign(dx*.7-s.vx*1.4);
    tick(s,{axis,climb:s.vy<wanted},1/60);
  }
  assert.equal(s.state,'won'); assert.equal(s.delivered,10); assert(s.fuel>0); assert.equal(s.hull,100);
});
