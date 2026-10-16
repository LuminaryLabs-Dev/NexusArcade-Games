export const SAVE_KEY = 'nexus-rooftop-rescue-v1';
export const SHIFT_SECONDS = 300;
export const PAD_X = 14;
export const CAPACITY = 3;
export const SITES = [
  { id: 'west', name: 'West Annex', x: 34, roof: 28, people: 2 },
  { id: 'market', name: 'Old Market', x: 56, roof: 38, people: 2 },
  { id: 'library', name: 'Library Roof', x: 78, roof: 31, people: 2 },
  { id: 'hotel', name: 'Lantern Hotel', x: 100, roof: 45, people: 2 },
  { id: 'east', name: 'East Apartments', x: 122, roof: 35, people: 2 },
];
export function freshSave() { return { version: 1, bestDelivered: 0, bestScore: 0, bestTime: null }; }
export function parseSave(raw) {
  try {
    const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!s || s.version !== 1 || !Number.isFinite(s.bestDelivered) || s.bestDelivered < 0 || !Number.isFinite(s.bestScore) || s.bestScore < 0 || !(s.bestTime === null || Number.isFinite(s.bestTime) && s.bestTime >= 0)) return freshSave();
    return { version: 1, bestDelivered: Math.floor(s.bestDelivered), bestScore: Math.floor(s.bestScore), bestTime: s.bestTime };
  } catch { return freshSave(); }
}
export function newFlight() {
  return { time: 0, x: PAD_X, y: 24, vx: 0, vy: 0, fuel: 100, hull: 100, passengers: 0, delivered: 0, score: 0, rescued: Object.fromEntries(SITES.map((site) => [site.id, 0])), landedAt: 'pad', rescueTimer: 0, rescueProgress: 0, wind: 0, glide: false, state: 'playing', notice: 'Choose a rooftop and glide in. Hold E to rescue, then return here to unload.', events: [] };
}
export function siteAt(x, tolerance = 5) { return SITES.find((site) => Math.abs(site.x - x) <= tolerance) ?? null; }
export function nearestLanding(x) {
  if (Math.abs(x - PAD_X) <= 5) return { id: 'pad', name: 'Evacuation pad', x: PAD_X, roof: 24, people: 0 };
  return siteAt(x);
}
export function remaining(s) { return SITES.reduce((sum, site) => sum + site.people - (s.rescued[site.id] ?? 0), 0); }
function land(s, target) {
  s.y = target.roof; s.vy = 0; s.landedAt = target.id; s.events.push({ type: 'land', id: target.id });
  if (target.id === 'pad' && s.passengers > 0) {
    const count = s.passengers; s.passengers = 0; s.delivered += count; s.score += count * 250; s.fuel = Math.min(100, s.fuel + 26); s.hull = Math.min(100, s.hull + 18);
    s.notice = `${count} ${count === 1 ? 'survivor' : 'survivors'} delivered. Fuel and hull serviced.`; s.events.push({ type: 'deliver', count });
    if (s.delivered >= SITES.reduce((n, site) => n + site.people, 0)) { s.state = 'won'; s.notice = 'Every rooftop is clear. The city is safe.'; s.events.push({ type: 'complete' }); }
  } else if (target.id === 'pad') { s.fuel = Math.min(100, s.fuel + 8); s.hull = Math.min(100, s.hull + 10); }
}
function collide(s, damage) {
  s.hull = Math.max(0, s.hull - damage); s.landedAt = null; s.vx *= .42; s.vy = 2; s.y = Math.max(2, s.y); s.notice = 'Hard landing! Slow down before the next roof.'; s.events.push({ type: 'impact', damage });
  if (s.hull <= 0) { s.state = 'over'; s.notice = 'The aircraft is out of service. Restart to fly again.'; s.events.push({ type: 'crash' }); }
}
export function tick(s, input, delta) {
  s.events = [];
  if (s.state !== 'playing') return s;
  const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, .05));
  if (!dt) return s;
  s.time = Math.min(SHIFT_SECONDS, s.time + dt);
  s.wind = Math.sin(s.time * .37) * 2.2 + Math.sin(s.time * .11 + 1) * 1.2;
  const axis = Math.max(-1, Math.min(1, Number.isFinite(input.axis) ? input.axis : 0));
  const climb = !!input.climb && s.fuel > 0;
  const descend = !!input.descend;
  if (s.landedAt) {
    if (axis || climb || descend) { s.landedAt = null; s.vy = Math.max(s.vy, 2.5); }
    else { s.vx = 0; s.vy = 0; s.glide = false; }
  }
  if (!s.landedAt) {
    s.vx = Math.max(-18, Math.min(18, s.vx + (axis * 18 + s.wind * .35 - s.vx * .22) * dt));
    const weight = 1 - Math.min(.44, s.passengers * .11);
    const lift = Math.max(0, Math.abs(s.vx) - 8) * .31 * weight;
    s.glide = !climb && Math.abs(s.vx) >= 8;
    s.vy += ((climb ? 12 : 0) + (s.glide ? lift : 0) - (descend ? 9 : 0) - 5.5) * dt;
    s.vy = Math.max(-14, Math.min(14, s.vy));
    s.x = Math.max(1, Math.min(132, s.x + s.vx * dt));
    const oldY = s.y; s.y += s.vy * dt;
    if (climb) s.fuel = Math.max(0, s.fuel - (3.4 + s.passengers * .28) * dt);
    if (s.time >= 180 && Math.floor(s.time * .6) % 3 === 0) s.fuel = Math.max(0, s.fuel - .16 * dt);
    const target = nearestLanding(s.x, 5);
    if (s.vy < 0 && target && oldY >= target.roof && s.y <= target.roof) {
      if (Math.abs(s.vx) <= 12 && Math.abs(s.vy) <= 7.5) land(s, target); else collide(s, Math.min(35, 8 + Math.max(0, Math.abs(s.vx) - 12) * 1.8 + Math.max(0, Math.abs(s.vy) - 7.5) * 2));
    }
    if (s.y <= 0) collide(s, 35);
  }
  if (input.rescue && s.landedAt && s.landedAt !== 'pad' && s.passengers < CAPACITY) {
    const site = SITES.find((x) => x.id === s.landedAt);
    if (site && (s.rescued[site.id] ?? 0) < site.people) {
      s.rescueProgress += dt;
      if (s.rescueProgress >= 1.15) {
        s.rescueProgress -= 1.15; s.rescued[site.id]++; s.passengers++; s.score += 75;
        s.notice = `${site.name}: survivor aboard (${s.passengers}/${CAPACITY}).`; s.events.push({ type: 'rescue', site: site.id, count: s.rescued[site.id] });
        if (s.passengers >= CAPACITY || s.rescued[site.id] >= site.people) s.rescueProgress = 0;
      }
    } else { s.rescueProgress = 0; }
  } else { s.rescueProgress = 0; }
  if (s.state === 'playing' && s.time >= SHIFT_SECONDS) { s.state = s.delivered === SITES.reduce((n, site) => n + site.people, 0) ? 'won' : 'over'; s.notice = s.state === 'won' ? 'Every rooftop is clear. The city is safe.' : 'Evacuation time is up. The city still needs help.'; s.events.push({ type: s.state === 'won' ? 'complete' : 'timeout' }); }
  return s;
}
export function finishSave(save, flight) {
  if (!['won', 'over'].includes(flight.state)) throw new Error('Flight is still active');
  const old = parseSave(save), time = flight.state === 'won' ? flight.time : old.bestTime;
  return { version: 1, bestDelivered: Math.max(old.bestDelivered, flight.delivered), bestScore: Math.max(old.bestScore, Math.floor(flight.score)), bestTime: old.bestTime === null ? time : time === null ? old.bestTime : Math.min(old.bestTime, time) };
}
