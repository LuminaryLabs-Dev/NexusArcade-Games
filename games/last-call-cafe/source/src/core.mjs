export const SAVE_KEY = 'nexus-last-call-cafe-v1';
export const RUSH_SECONDS = 300;
export const MENU = {
  espresso: { title: 'Espresso', steps: ['grind', 'brew'], value: 80, patience: 36 },
  latte: { title: 'Oat latte', steps: ['grind', 'steam', 'pour'], value: 125, patience: 48 },
  croissant: { title: 'Warm croissant', steps: ['warm', 'plate'], value: 95, patience: 42 },
  garden: { title: 'Garden toast', steps: ['chop', 'toast', 'plate'], value: 140, patience: 54 },
};
export const ACTIONS = ['grind', 'brew', 'steam', 'pour', 'warm', 'chop', 'toast', 'plate', 'serve'];
const SCHEDULE = [0, 15, 28, 42, 55, 68, 80, 93, 105, 117, 130, 142, 154, 166, 178, 190, 202, 214, 226, 238, 250, 262, 274, 286];
const ORDERS = ['espresso', 'latte', 'croissant', 'garden'];

export function freshSave() { return { version: 1, bestScore: 0, bestServed: 0, upgrades: [] }; }
export function parseSave(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || value.version !== 1 || !Number.isFinite(value.bestScore) || value.bestScore < 0 || !Number.isFinite(value.bestServed) || value.bestServed < 0 || !Array.isArray(value.upgrades)) return freshSave();
    return { version: 1, bestScore: Math.floor(value.bestScore), bestServed: Math.floor(value.bestServed), upgrades: value.upgrades.filter((x) => typeof x === 'string').slice(0, 3) };
  } catch { return freshSave(); }
}
export function newRush(upgrades = []) {
  return { time: 0, score: 0, served: 0, missed: 0, hearts: 3, combo: 0, bestCombo: 0, queue: [], nextGuest: 0, guestSerial: 1, selected: null, progress: 0, upgrades: [...new Set(upgrades)].slice(0, 3), paused: false, upgradeDue: false, lastUpgradeAt: 0, state: 'ready', notice: 'First order is up. Read the ticket, then build it step by step.', events: [] };
}
export function startRush(s) { if (!s || s.state !== 'ready') return false; s.state = 'playing'; s.notice = 'First order is up. Read the ticket, then build it step by step.'; return true; }
export function activeGuest(s) { return s.queue[0] ?? null; }
export function recipe(s) { const guest = activeGuest(s); return guest ? MENU[guest.order] : null; }
export function nextStep(s) { const r = recipe(s); return r?.steps[s.progress] ?? null; }
export function spawnGuest(s, order = ORDERS[(s.guestSerial - 1) % ORDERS.length]) {
  const recipe = MENU[order];
  if (!recipe || s.queue.length >= 4) { s.missed++; s.hearts = Math.max(0, s.hearts - 1); s.combo = 0; s.events.push({ type: 'miss', reason: recipe ? 'The line is full' : 'Unknown order' }); if (!s.hearts) s.state = 'over'; return null; }
  const guest = { id: s.guestSerial++, order, patience: recipe.patience + (s.upgrades.includes('calm-counter') ? 10 : 0), maxPatience: recipe.patience + (s.upgrades.includes('calm-counter') ? 10 : 0), enteredAt: s.time };
  s.queue.push(guest); s.events.push({ type: 'arrive', id: guest.id, order }); return guest;
}
export function chooseUpgrade(s, id) {
  const choices = ['calm-counter', 'sharp-tools', 'generous-tips'];
  if (s.state !== 'playing' || !s.upgradeDue || !choices.includes(id) || s.upgrades.includes(id)) return false;
  s.upgrades.push(id); s.upgradeDue = false; s.lastUpgradeAt = s.time; s.paused = false;
  for (const guest of s.queue) if (id === 'calm-counter') { guest.maxPatience += 10; guest.patience += 10; }
  s.notice = ({ 'calm-counter': 'Calm Counter: every customer can wait a little longer.', 'sharp-tools': 'Sharp Tools: wrong turns no longer cost patience.', 'generous-tips': 'Generous Tips: quick service pays more.' })[id];
  s.events.push({ type: 'upgrade', id }); return true;
}
export function act(s, action) {
  s.events = [];
  if (s.state !== 'playing' || s.paused || s.upgradeDue || !ACTIONS.includes(action)) return s;
  const guest = activeGuest(s), r = recipe(s);
  if (!guest || !r) { s.notice = 'No ticket at the counter yet.'; return s; }
  const expected = nextStep(s);
  if (action === expected) {
    s.progress++; s.notice = `${action[0].toUpperCase()}${action.slice(1)} done · ${s.progress}/${r.steps.length}`; s.events.push({ type: 'prep', action });
    return s;
  }
  if (action === 'serve') {
    if (s.progress < r.steps.length) { s.notice = `Still needs ${r.steps.slice(s.progress).join(' → ')}.`; s.events.push({ type: 'early-serve' }); return s; }
    const fraction = Math.max(0, guest.patience / guest.maxPatience);
    const tip = Math.round((s.upgrades.includes('generous-tips') ? 55 : 35) * fraction);
    s.score += r.value + tip + Math.min(s.combo, 8) * 8; s.served++; s.combo++; s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.queue.shift(); s.progress = 0; s.notice = `Order served · ${r.value + tip} coins${s.combo > 1 ? ` · ${s.combo} in a row` : ''}`; s.events.push({ type: 'serve', score: r.value + tip }); return s;
  }
  s.notice = `Not yet. The ticket needs ${expected}.`; s.events.push({ type: 'wrong', expected });
  if (!s.upgrades.includes('sharp-tools')) guest.patience = Math.max(0, guest.patience - 4);
  return s;
}
export function tick(s, delta) {
  s.events = [];
  if (s.state !== 'playing' || s.paused) return s;
  const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, .1));
  if (dt === 0) return s;
  const previous = s.time; s.time = Math.min(RUSH_SECONDS, s.time + dt);
  while (s.nextGuest < SCHEDULE.length && SCHEDULE[s.nextGuest] <= s.time) {
    spawnGuest(s); s.nextGuest++;
  }
  const patienceRate = s.upgrades.includes('calm-counter') ? .78 : 1;
  for (const guest of s.queue) guest.patience = Math.max(0, guest.patience - dt * patienceRate);
  if (s.queue[0]?.patience === 0) {
    const guest = s.queue.shift(); s.missed++; s.hearts = Math.max(0, s.hearts - 1); s.combo = 0; s.progress = 0;
    s.notice = `${MENU[guest.order].title} waited too long. The next ticket is ready.`; s.events.push({ type: 'miss', id: guest.id, reason: 'patience' });
    if (s.hearts === 0) s.state = 'over';
  }
  const milestone = Math.floor(s.time / 60);
  if (s.state === 'playing' && s.time < RUSH_SECONDS && milestone > 0 && milestone > Math.floor(s.lastUpgradeAt / 60) && s.upgrades.length < Math.min(3, milestone)) {
    s.upgradeDue = true; s.paused = true; s.notice = 'Rush lull! Choose one counter upgrade.'; s.events.push({ type: 'upgrade-due' });
  }
  if (s.time >= RUSH_SECONDS && s.state === 'playing') { s.state = 'won'; s.paused = false; s.notice = 'Closing time. The café is saved.'; s.events.push({ type: 'close', elapsed: s.time - previous }); }
  return s;
}
export function finishSave(save, run) {
  if (!['won', 'over'].includes(run.state)) throw new Error('The rush is still running');
  const current = parseSave(save);
  return { version: 1, bestScore: Math.max(current.bestScore, Math.floor(run.score)), bestServed: Math.max(current.bestServed, run.served), upgrades: run.upgrades.slice(0, 3) };
}
