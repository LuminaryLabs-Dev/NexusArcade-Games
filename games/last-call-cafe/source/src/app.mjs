import { MENU, RUSH_SECONDS, SAVE_KEY, act, activeGuest, chooseUpgrade, finishSave, freshSave, newRush, nextStep, parseSave, recipe, startRush, tick } from './core.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('cafeArt'), ctx = canvas.getContext('2d');
const actionNames = { grind: 'Grind', brew: 'Brew', steam: 'Steam', pour: 'Pour', warm: 'Warm', chop: 'Chop', toast: 'Toast', plate: 'Plate', serve: 'Serve' };
const hotkeys = { grind: '1', brew: '2', steam: '3', pour: '4', warm: '5', chop: '6', toast: '7', plate: '8', serve: 'Enter' };
const guestColor = { espresso: '#bd7259', latte: '#859b70', croissant: '#d29b51', garden: '#639484' };
let save = freshSave(), run = null, raf = 0, lastTime = 0, paused = true, prevState = '', authoredProp = null;
try { save = parseSave(localStorage.getItem(SAVE_KEY)); } catch { $('storage').textContent = 'Storage is blocked. Your best score will only last for this tab.'; }
function announce(text) { $('notice').textContent = text; }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { $('storage').textContent = 'Could not save this run. Keep the tab open until closing time.'; } }
function artSize() { const ratio = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.floor(canvas.clientWidth * ratio); canvas.height = Math.floor(canvas.clientHeight * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); drawArt(); }
function roundRect(x, y, w, h, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function drawArt() {
  if (!ctx) return;
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  ctx.clearRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#213b42'); sky.addColorStop(.55, '#e7b773'); sky.addColorStop(1, '#cf8e53'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f4d899'; ctx.beginPath(); ctx.arc(w * .77, h * .27, Math.min(w, h) * .1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#183b3d'; ctx.fillRect(w * .04, h * .1, w * .36, h * .45); ctx.fillStyle = '#87a8a1'; ctx.fillRect(w * .06, h * .12, w * .32, h * .4);
  ctx.strokeStyle = '#e6d6b5'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(w * .22, h * .12); ctx.lineTo(w * .22, h * .52); ctx.moveTo(w * .06, h * .32); ctx.lineTo(w * .38, h * .32); ctx.stroke();
  roundRect(w * .08, h * .63, w * .82, h * .19, 17, '#694433'); roundRect(w * .1, h * .63, w * .78, h * .05, 8, '#e5b975');
  roundRect(w * .3, h * .48, w * .38, h * .15, 12, '#3d5147');
  if (authoredProp) drawAuthoredProp(w * .49, h * .475, Math.min(w * .18, h * .22));
  else roundRect(w * .37, h * .4, w * .24, h * .09, 12, '#d6b071');
  ctx.fillStyle = '#213436'; ctx.beginPath(); ctx.arc(w * .5, h * .39, Math.min(w, h) * .072, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c397'; ctx.beginPath(); ctx.arc(w * .5, h * .39, Math.min(w, h) * .051, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#40343a'; ctx.beginPath(); ctx.arc(w * .5, h * .366, Math.min(w, h) * .055, Math.PI, Math.PI * 2); ctx.fill();
  roundRect(w * .442, h * .438, w * .116, h * .155, 16, '#d7855d');
  for (let i = 0; i < 4; i++) { const x = w * (.16 + i * .19); roundRect(x, h * .695, w * .115, h * .065, 8, i === 0 && run?.progress ? '#e7d5a5' : '#cfb18a'); }
  if (run && activeGuest(run)) {
    const guest = activeGuest(run), color = guestColor[guest.order];
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(w * .84, h * .5, Math.min(w, h) * .075, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2d8bd'; ctx.beginPath(); ctx.arc(w * .84, h * .46, Math.min(w, h) * .048, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#523a35'; ctx.beginPath(); ctx.arc(w * .84, h * .44, Math.min(w, h) * .048, Math.PI, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = '700 12px system-ui'; ctx.fillStyle = '#183b3d'; ctx.fillText(MENU[guest.order].title, w * .84, h * .63);
  }
}
function drawAuthoredProp(cx, cy, size) {
  const project = ([x, y, z]) => [cx + (x - z) * size * .72, cy + (x + z) * size * .23 - y * size * .82];
  const faces = authoredProp.faces.map((refs) => {
    const points = refs.map((i) => project(authoredProp.vertices[i]));
    return { points, depth: points.reduce((n, p) => n + p[1], 0) / points.length };
  }).sort((a, b) => a.depth - b.depth);
  ctx.save();
  for (let i = 0; i < faces.length; i++) {
    const points = faces[i].points; if (points.length < 3) continue;
    ctx.beginPath(); ctx.moveTo(...points[0]); for (const point of points.slice(1)) ctx.lineTo(...point); ctx.closePath();
    ctx.fillStyle = ['#d8ad6f', '#a7764c', '#c2955d', '#7f5e43', '#e4c18b', '#946b48'][i % 6]; ctx.fill();
    ctx.strokeStyle = '#f3d5a5'; ctx.globalAlpha = .7; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function formatTime(seconds) { const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60); return `${m}:${String(s).padStart(2, '0')}`; }
function render() {
  drawArt();
  if (!run) { $('elapsed').textContent = '5:00'; $('score').textContent = String(save.bestScore); $('served').textContent = String(save.bestServed); $('bestLabel').textContent = String(save.bestScore); $('servedBestLabel').textContent = String(save.bestServed); for (const button of document.querySelectorAll('[data-action]')) button.disabled = true; return; }
  $('elapsed').textContent = formatTime(Math.max(0, RUSH_SECONDS - run.time)); $('score').textContent = String(run.score); $('served').textContent = String(run.served); $('hearts').textContent = '♥'.repeat(run.hearts) + '♡'.repeat(3 - run.hearts); $('combo').textContent = `Streak ${run.combo}`;
  $('rushBar').value = run.time; $('rushBar').max = RUSH_SECONDS;
  $('line').replaceChildren();
  for (const guest of run.queue) {
    const card = document.createElement('div'); card.className = `ticket${guest.id === run.queue[0]?.id ? ' current' : ''}`;
    const title = document.createElement('b'); title.textContent = MENU[guest.order].title;
    const patience = document.createElement('progress'); patience.max = guest.maxPatience; patience.value = guest.patience;
    const label = document.createElement('small'); label.textContent = guest.id === run.queue[0]?.id ? 'NOW SERVING' : 'UP NEXT';
    card.append(label, title, patience); $('line').append(card);
  }
  const current = activeGuest(run), r = recipe(run), step = nextStep(run);
  $('activeOrder').textContent = current ? MENU[current.order].title : 'Counter clear';
  $('orderHint').textContent = current ? `Ticket ${current.id} · ${r.steps.map((x, i) => `${i < run.progress ? '✓ ' : i === run.progress ? '➜ ' : ''}${actionNames[x]}`).join('  →  ')}` : 'Next customer is just around the corner';
  for (const button of document.querySelectorAll('[data-action]')) { const action = button.dataset.action; button.disabled = run.state !== 'playing' || paused || run.upgradeDue || (!current) || (action === 'serve' && run.progress < (r?.steps.length ?? 0)); button.classList.toggle('next', action === step); }
  for (const button of document.querySelectorAll('[data-upgrade]')) button.disabled = run.upgrades.includes(button.dataset.upgrade);
  const showIntro = run.state === 'ready'; $('intro').hidden = !showIntro;
  $('upgrade').hidden = !run.upgradeDue; $('endCard').hidden = !['won', 'over'].includes(run.state);
  if (run.state !== prevState) { prevState = run.state; if (['won', 'over'].includes(run.state)) { save = finishSave(save, run); persist(); $('resultTitle').textContent = run.state === 'won' ? 'Closed on a high note' : 'The queue got away'; $('resultCopy').textContent = `${run.served} orders served · ${run.score} coins · best streak ${run.bestCombo}.`; } }
}
function activate() { if (!startRush(run)) return; paused = false; lastTime = performance.now(); announce(run.notice); render(); }
function begin() { run = newRush(); paused = true; prevState = ''; render(); $('intro').hidden = false; }
function perform(action) { if (!run || paused || run.upgradeDue) return; act(run, action); announce(run.notice); render(); }
function togglePause() { if (!run || !['playing'].includes(run.state) || run.upgradeDue) return; paused = !paused; announce(paused ? 'Paused. Press Escape or choose Resume to continue.' : 'Back to the rush.'); $('pause').textContent = paused ? 'Resume' : 'Pause'; if (!paused) lastTime = performance.now(); render(); }
for (const button of document.querySelectorAll('[data-action]')) button.addEventListener('click', () => perform(button.dataset.action));
$('start').addEventListener('click', activate); $('restart').addEventListener('click', begin); $('pause').addEventListener('click', togglePause);
function upgrade(id) { if (!run || !chooseUpgrade(run, id)) return false; paused = false; lastTime = performance.now(); return true; }
for (const button of document.querySelectorAll('[data-upgrade]')) button.addEventListener('click', () => { if (upgrade(button.dataset.upgrade)) { announce(run.notice); render(); } });
document.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') { event.preventDefault(); togglePause(); return; }
  if (!run) return;
  if (run.state === 'ready' && ['Enter', 'Space'].includes(event.code)) { event.preventDefault(); activate(); return; }
  if (run.upgradeDue) { const i = Number(event.key) - 1; if (i >= 0 && i < 3) { const choices = ['calm-counter', 'sharp-tools', 'generous-tips']; upgrade(choices[i]); render(); } return; }
  const action = { Digit1: 'grind', Digit2: 'brew', Digit3: 'steam', Digit4: 'pour', Digit5: 'warm', Digit6: 'chop', Digit7: 'toast', Digit8: 'plate', Enter: 'serve' }[event.code];
  if (action) { event.preventDefault(); perform(action); }
});
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (run && !paused && run.state === 'playing') {
    const elapsed = Math.min(.1, Math.max(0, (now - lastTime) / 1000)); lastTime = now; tick(run, elapsed);
    if (run.upgradeDue) { paused = true; $('pause').textContent = 'Pause'; announce(run.notice); }
    else if (run.state !== 'playing') { paused = true; announce(run.notice); }
    else if (run.events.some((e) => e.type === 'miss' || e.type === 'arrive')) announce(run.notice);
  }
  render();
}
async function loadAuthoring() {
  try {
    const { createEngine, createAuthoringDomain } = await import('./engine-runtime.mjs');
    const engine = createEngine({ kits: createAuthoringDomain() });
    const project = engine.n.authoringProject, epoch = project.context().epoch;
    const receipt = project.execute({ requestId: 'last-call-cafe:counter-cube:v1', epoch, operations: [{ id: 'mesh.cube', args: { id: 'cafe-counter-prop', size: 1 } }] });
    const document = project.getDocument('cafe-counter-prop');
    if (receipt?.ok === false || !document?.content?.vertices?.length || !document?.content?.faces?.length) throw new Error('Authoring did not return a counter prop mesh');
    const ids = new Map(document.content.vertices.map((v, i) => [v.id, i]));
    authoredProp = { vertices: document.content.vertices.map((v) => v.position), faces: document.content.faces.map((face) => face.vertices.map((id) => ids.get(id))) };
    $('engineState').textContent = 'NexusEngine Authoring checked'; $('engineState').classList.add('good');
  } catch (error) {
    console.error('NexusEngine Authoring did not initialize.', error);
    $('engineState').textContent = 'Authoring kit unavailable · fallback café art'; $('engineState').classList.add('warn');
  }
}
window.addEventListener('resize', artSize); window.addEventListener('blur', () => { if (run?.state === 'playing' && !paused && !run.upgradeDue) togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && run?.state === 'playing' && !paused && !run.upgradeDue) togglePause(); });
window.addEventListener('pagehide', () => { cancelAnimationFrame(raf); window.removeEventListener('resize', artSize); }, { once: true });
artSize(); begin(); loadAuthoring(); raf = requestAnimationFrame(frame);

window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
