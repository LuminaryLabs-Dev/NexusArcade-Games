import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU, RUSH_SECONDS, act, activeGuest, chooseUpgrade, finishSave, freshSave, newRush, nextStep, parseSave, spawnGuest, startRush, tick } from '../src/core.mjs';
const advance = (s, seconds) => { for (let left = seconds; left > 0; left -= .1) tick(s, Math.min(.1, left)); };

test('fresh rush issues the first order and prep follows the recipe exactly', () => {
  const s = newRush(); assert.equal(s.state, 'ready'); assert.equal(startRush(s), true); assert.equal(startRush(s), false); tick(s, .1);
  assert.equal(activeGuest(s).order, 'espresso'); assert.equal(nextStep(s), 'grind');
  act(s, 'brew'); assert.ok(Math.abs(s.queue[0].patience - (MENU.espresso.patience - 4.1)) < 1e-9); assert.equal(s.progress, 0);
  act(s, 'grind'); act(s, 'brew'); assert.equal(s.progress, 2);
  const before = s.score; act(s, 'serve'); assert.equal(s.queue.length, 0); assert.ok(s.score > before); assert.equal(s.served, 1);
});

test('latte and food tickets require every preparation stage before serving', () => {
  const s = newRush(); startRush(s); tick(s, .1); s.queue = []; s.progress = 0;
  s.guestSerial = 2; spawnGuest(s, 'latte');
  for (const step of MENU.latte.steps) { assert.equal(nextStep(s), step); act(s, step); }
  act(s, 'serve'); assert.equal(s.served, 1);
  s.guestSerial = 3; spawnGuest(s, 'garden');
  for (const step of MENU.garden.steps) act(s, step);
  act(s, 'serve'); assert.equal(s.served, 2);
});

test('five-minute closing completes the run and only terminal runs can save', () => {
  const s = newRush(); assert.throws(() => finishSave(freshSave(), s), /still running/); startRush(s);
  s.time = RUSH_SECONDS - .05; s.nextGuest = 24; s.queue = []; tick(s, 1); assert.equal(s.state, 'won');
  const saved = finishSave({ version: 1, bestScore: 4, bestServed: 2, upgrades: [] }, s);
  assert.deepEqual(saved, { version: 1, bestScore: 4, bestServed: 2, upgrades: [] });
});

test('upgrades are offered at one-minute breaks and change actual mechanics', () => {
  const s = newRush(); startRush(s); s.nextGuest = 24; s.time = 59.9; s.queue = [{ id: 99, order: 'espresso', patience: 36, maxPatience: 36 }]; tick(s, .1); assert.equal(s.upgradeDue, true); assert.equal(s.paused, true);
  assert.equal(chooseUpgrade(s, 'sharp-tools'), true);
  const patience = activeGuest(s).patience; act(s, 'steam'); assert.equal(activeGuest(s).patience, patience);
  s.queue = [{ id: 100, order: 'latte', patience: 40, maxPatience: 48 }]; s.nextGuest = 24; s.time = 119.9; tick(s, .1); assert.equal(s.upgradeDue, true); chooseUpgrade(s, 'calm-counter');
  assert.ok(activeGuest(s).maxPatience >= MENU[activeGuest(s).order].patience + 10);
});

test('invalid and corrupted saves are reset without exceptions', () => {
  assert.deepEqual(parseSave('{bad'), freshSave()); assert.deepEqual(parseSave(null), freshSave());
  assert.deepEqual(parseSave({ version: 1, bestScore: -2, bestServed: 0, upgrades: [] }), freshSave());
  assert.deepEqual(parseSave({ version: 1, bestScore: 18.9, bestServed: 5.8, upgrades: ['generous-tips', 3, 'calm-counter'] }), { version: 1, bestScore: 18, bestServed: 5, upgrades: ['generous-tips', 'calm-counter'] });
});

test('missed customers cost energy and a full line has a clear loss condition', () => {
  const s = newRush(); startRush(s); tick(s, .1); s.queue[0].patience = .1; tick(s, .1);
  assert.equal(s.hearts, 2); assert.equal(s.missed, 1);
  s.hearts = 1; s.queue = [1, 2, 3, 4].map((id) => ({ id, order: 'espresso', patience: 20, maxPatience: 36 }));
  spawnGuest(s, 'latte'); assert.equal(s.state, 'over'); assert.equal(s.hearts, 0);
});
