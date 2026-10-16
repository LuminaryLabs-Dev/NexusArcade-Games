import { CAPACITY, PAD_X, SAVE_KEY, SHIFT_SECONDS, SITES, finishSave, freshSave, newFlight, parseSave, remaining, tick } from './core.mjs';

const $ = (id) => document.getElementById(id), canvas = $('sky'), ctx = canvas.getContext('2d'), keys = new Set();
let save = freshSave(), flight = null, raf = 0, last = 0, paused = true, prevState = '', authored = null;
try { save = parseSave(localStorage.getItem(SAVE_KEY)); } catch { $('storage').textContent = 'Storage is blocked; this flight will only save in the current tab.'; }
const keyControls = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'climb', KeyW: 'climb', ArrowDown: 'descend', KeyS: 'descend', KeyE: 'rescue' };
function resize() { const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.floor(canvas.clientWidth * dpr); canvas.height = Math.floor(canvas.clientHeight * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawWorld(); }
function boxGeometry(cx, cy, size, color) {
  const project = ([x, y, z]) => [cx + (x - z) * size * .72, cy + (x + z) * size * .23 - y * size * .82];
  const faces = authored.faces.map((indices) => { const points = indices.map((i) => project(authored.vertices[i])); return { points, depth: points.reduce((n, p) => n + p[1], 0) / points.length }; }).sort((a, b) => a.depth - b.depth);
  for (let i = 0; i < faces.length; i++) { const points = faces[i].points; ctx.beginPath(); ctx.moveTo(...points[0]); for (const p of points.slice(1)) ctx.lineTo(...p); ctx.closePath(); ctx.fillStyle = [color, '#2d6070', '#5195a0', '#234f60', '#84bba9', '#316876'][i % 6]; ctx.fill(); ctx.strokeStyle = '#daefce'; ctx.globalAlpha = .65; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; }
}
function drawWorld() {
  if (!ctx) return; const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; ctx.clearRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, 0, h); gradient.addColorStop(0, '#2a7184'); gradient.addColorStop(.55, '#7bc1c4'); gradient.addColorStop(1, '#d5c184'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * .73, h * .23, 3, w * .73, h * .23, h * .18); sun.addColorStop(0, '#ffedb4cc'); sun.addColorStop(1, '#ffedb400'); ctx.fillStyle = sun; ctx.fillRect(w * .5, 0, w * .5, h * .55);
  const px = (x) => w / 2 + (x - (flight?.x ?? PAD_X)) * w / 58;
  const py = (altitude) => h - 45 - altitude * (h - 86) / 62;
  ctx.fillStyle = '#d7ebe3a0';
  for (let i = -2; i < 6; i++) { const x = ((i * 173 + (flight?.time ?? 0) * 7) % (w + 150)) - 75; const y = 38 + ((i * 37) % 70); ctx.beginPath(); ctx.ellipse(x, y, 27, 7, 0, 0, Math.PI * 2); ctx.ellipse(x + 13, y - 6, 18, 10, 0, 0, Math.PI * 2); ctx.fill(); }
  const baseY = py(0); ctx.fillStyle = '#244a53'; ctx.fillRect(0, baseY, w, h - baseY);
  for (let x = -25; x < 165; x += 11) { const bx = px(x), width = w * 11 / 58, bh = 12 + ((x * 13 + 200) % 17); ctx.fillStyle = '#5f9796'; ctx.fillRect(bx, py(bh), width, baseY - py(bh)); ctx.fillStyle = '#f7d59280'; for (let j = 0; j < 4; j++) for (let k = 0; k < 2; k++) ctx.fillRect(bx + width * (.2 + j * .2), py(bh) + 9 + k * 11, 3, 4); }
  const buildings = [...SITES.map((s) => ({ ...s, w: 13 })), { id: 'pad', name: 'Evacuation pad', x: PAD_X, roof: 24, people: 0, w: 10 }];
  for (const b of buildings) {
    const bx = px(b.x - b.w / 2), top = py(b.roof), bw = w * b.w / 58;
    ctx.fillStyle = b.id === 'pad' ? '#365e5a' : '#365b62'; ctx.fillRect(bx, top, bw, baseY - top);
    ctx.fillStyle = b.id === 'pad' ? '#dfb569' : '#b3b6a0'; ctx.fillRect(bx, top, bw, 5);
    for (let row = 0; row < Math.floor((baseY - top) / 20); row++) for (let col = 0; col < 3; col++) { ctx.fillStyle = (row + col) % 3 ? '#b7d6c466' : '#f8d88799'; ctx.fillRect(bx + bw * (.18 + col * .28), top + 15 + row * 19, Math.max(3, bw * .12), 8); }
    if (b.id === 'pad') { ctx.fillStyle = '#ffe396'; ctx.fillRect(bx + bw * .2, top - 3, bw * .6, 4); ctx.fillStyle = '#fff1bf'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('EVAC', bx + bw / 2, top - 10); }
    else {
      const count = flight?.rescued[b.id] ?? 0; for (let i = count; i < b.people; i++) { ctx.fillStyle = '#f2cd85'; ctx.beginPath(); ctx.arc(bx + bw * (.32 + i * .34), top - 6, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#f7f2dc'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(b.name, bx + bw / 2, top - 14);
    }
  }
  if (flight) {
    const x = px(flight.x), y = py(flight.y), bodyColor = flight.passengers ? '#f1c77b' : '#99d3b8';
    if (flight.glide) { ctx.strokeStyle = '#f5e4a0'; ctx.globalAlpha = .5; ctx.beginPath(); ctx.moveTo(x - 15, y - 3); ctx.lineTo(x - Math.sign(flight.vx) * 80, y - 15); ctx.stroke(); ctx.globalAlpha = 1; }
    if (authored) boxGeometry(x, y, Math.min(20, w * .04), bodyColor);
    else { ctx.fillStyle = bodyColor; ctx.beginPath(); ctx.moveTo(x - 17, y); ctx.lineTo(x - 7, y - 8); ctx.lineTo(x + 12, y - 5); ctx.lineTo(x + 18, y); ctx.lineTo(x + 7, y + 5); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = '#173e48'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 20, y - 9); ctx.lineTo(x + 20, y - 9); ctx.moveTo(x, y - 10); ctx.lineTo(x, y - 17); ctx.stroke();
    ctx.fillStyle = '#f6dfac'; ctx.beginPath(); ctx.arc(x + (flight.vx >= 0 ? 7 : -7), y - 1, 3, 0, Math.PI * 2); ctx.fill();
    if (flight.landedAt && flight.landedAt !== 'pad') { ctx.fillStyle = '#fff1b7'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`HOLD E · ${Math.round(flight.rescueProgress / 1.15 * 100)}%`, x, y - 30); }
  }
  ctx.strokeStyle = '#f9dc8b'; ctx.globalAlpha = .75; ctx.beginPath(); ctx.moveTo(0, baseY); ctx.lineTo(w, baseY); ctx.stroke(); ctx.globalAlpha = 1;
}
function fmt(n) { return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`; }
function routeCards() { $('routes').replaceChildren(); for (const site of SITES) { const n = flight?.rescued[site.id] ?? 0; const card = document.createElement('div'); card.className = 'route'; const title = document.createElement('b'); title.textContent = site.name; const altitude = document.createElement('small'); altitude.textContent = `${site.roof} m · rooftop ${Math.min(2, site.people - n)} waiting`; const count = document.createElement('span'); count.className = 'people'; count.textContent = `${n}/${site.people} safe`; card.append(title, altitude, count); $('routes').append(card); } const pad = document.createElement('div'); pad.className = 'route pad'; pad.innerHTML = '<b>Evacuation pad</b><small>Base · unload & service</small><span class="people">Marked in gold</span>'; $('routes').append(pad); }
function render() {
  drawWorld();
  if (!flight) { $('time').textContent = '5:00'; $('fuel').value = 100; $('hull').value = 100; $('fuelText').textContent = '100%'; $('hullText').textContent = '100%'; $('cargo').textContent = '0'; $('delivered').textContent = `${save.bestDelivered} / 10`; $('score').textContent = String(save.bestScore); $('saved').textContent = String(save.bestDelivered); $('bestSaved').textContent = String(save.bestDelivered); $('bestScore').textContent = String(save.bestScore); routeCards(); return; }
  $('time').textContent = fmt(Math.max(0, SHIFT_SECONDS - flight.time)); $('fuel').value = flight.fuel; $('hull').value = flight.hull; $('fuelText').textContent = `${Math.round(flight.fuel)}%`; $('hullText').textContent = `${Math.round(flight.hull)}%`; $('cargo').textContent = String(flight.passengers); $('delivered').textContent = `${flight.delivered} / 10`; $('score').textContent = String(flight.score); $('saved').textContent = String(flight.delivered); $('wind').textContent = `${flight.wind.toFixed(1)} m/s`;
  const target = SITES.find((site) => site.id === flight.landedAt);
  $('landingHint').textContent = target ? (flight.rescued[target.id] < target.people ? `Landed at ${target.name}. Hold E / Rescue to bring the remaining people aboard.` : 'This rooftop is clear. Return to the gold evacuation pad.') : flight.landedAt === 'pad' ? (flight.passengers ? 'Touching down at the pad will automatically deliver survivors and service the aircraft.' : 'At the evacuation pad. Choose a rooftop and glide in.') : flight.glide ? 'Gliding: forward speed is generating lift without powered climb. Passengers reduce lift.' : 'In powered flight. Climb costs fuel; ease off the climb key to glide.';
  $('notice').textContent = flight.notice; routeCards(); $('intro').hidden = true; $('endCard').hidden = !['won', 'over'].includes(flight.state);
  if (flight.state !== prevState) { prevState = flight.state; if (['won', 'over'].includes(flight.state)) { save = finishSave(save, flight); try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { $('storage').textContent = 'Could not save this mission. Keep the tab open to view your report.'; } $('resultTitle').textContent = flight.state === 'won' ? 'Every rooftop is clear' : 'The city still needs help'; $('resultCopy').textContent = `${flight.delivered}/10 delivered · ${flight.score} points · ${remaining(flight)} still waiting.`; } }
}
function clearInput() { keys.clear(); for (const button of document.querySelectorAll('.touch .active')) button.classList.remove('active'); }
function launch() { clearInput(); flight = newFlight(); paused = false; prevState = ''; last = performance.now(); $('pause').textContent = 'Pause'; render(); }
function togglePause() { if (!flight || flight.state !== 'playing') return; paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; $('notice').textContent = paused ? 'Flight paused. Press Escape or Resume to continue.' : flight.notice; if (!paused) last = performance.now(); }
function input() { return { axis: (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0), climb: keys.has('climb'), descend: keys.has('descend'), rescue: keys.has('rescue') }; }
document.addEventListener('keydown', (event) => { const action = keyControls[event.code]; if (action) { event.preventDefault(); keys.add(action); } if (event.code === 'Escape') { event.preventDefault(); togglePause(); } if (!flight && ['Enter', 'Space'].includes(event.code)) launch(); });
document.addEventListener('keyup', (event) => { const action = keyControls[event.code]; if (action) keys.delete(action); });
for (const button of document.querySelectorAll('[data-hold]')) { const action = button.dataset.hold; const down = (event) => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); button.classList.add('active'); keys.add(action); }; const up = () => { button.classList.remove('active'); keys.delete(action); }; button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('lostpointercapture', up); }
$('start').addEventListener('click', launch); $('restart').addEventListener('click', launch); $('pause').addEventListener('click', togglePause);
function frame(now) { raf = requestAnimationFrame(frame); if (flight && !paused && flight.state === 'playing') { const elapsed = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now; tick(flight, input(), elapsed); if (flight.events.length) $('notice').textContent = flight.notice; if (flight.state !== 'playing') paused = true; } render(); }
async function loadAuthoring() {
  try {
    const { createEngine, createAuthoringDomain } = await import('./engine-runtime.mjs');
    const engine = createEngine({ kits: createAuthoringDomain() }), project = engine.n.authoringProject, epoch = project.context().epoch;
    const receipt = project.execute({ requestId: 'rooftop-rescue:aircraft-hull:v1', epoch, operations: [{ id: 'mesh.cube', args: { id: 'rescue-aircraft-hull', size: 1 } }] });
    const doc = project.getDocument('rescue-aircraft-hull'); if (receipt?.ok === false || !doc?.content?.vertices?.length || !doc?.content?.faces?.length) throw new Error('Authoring did not return aircraft hull geometry');
    const lookup = new Map(doc.content.vertices.map((v, i) => [v.id, i])); authored = { vertices: doc.content.vertices.map((v) => v.position), faces: doc.content.faces.map((f) => f.vertices.map((id) => lookup.get(id))) };
    $('engineState').textContent = 'NexusEngine-authored aircraft hull'; $('engineState').classList.add('good');
  } catch (error) { console.error('NexusEngine Authoring did not initialize.', error); $('engineState').textContent = 'Authoring kit unavailable · fallback hull'; $('engineState').classList.add('warn'); }
}
window.addEventListener('resize', resize); window.addEventListener('blur', () => { clearInput(); if (flight?.state === 'playing' && !paused) togglePause(); }); document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (flight?.state === 'playing' && !paused) togglePause(); } }); window.addEventListener('pagehide', () => { clearInput(); cancelAnimationFrame(raf); window.removeEventListener('resize', resize); }, { once: true });
resize(); render(); loadAuthoring(); raf = requestAnimationFrame(frame);

window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
