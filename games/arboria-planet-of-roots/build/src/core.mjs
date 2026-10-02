const SESSION_SECONDS = 300;
const RAIN_SECONDS = 18;
const RAIN_COST = 50;
const CLAIM_COST = 15;
const ENERGY_INTERVAL = 3.5;
const MISSION_REWARD = 80;
const SPECIES = Object.freeze([
  Object.freeze({ id: 'oak', name: 'Green Oak', cost: 20, yield: 1 }),
  Object.freeze({ id: 'pine', name: 'Alpine Pine', cost: 35, yield: 1 }),
  Object.freeze({ id: 'cherry', name: 'Sakura', cost: 50, yield: 2 }),
  Object.freeze({ id: 'willow', name: 'Sun Willow', cost: 80, yield: 3 }),
]);
const MISSIONS = Object.freeze([
  Object.freeze({ type: 'trees', target: 3, label: 'Plant 3 trees in your starting grove.' }),
  Object.freeze({ type: 'territory', target: 10, label: 'Expand territory to 10 claimed cells.' }),
  Object.freeze({ type: 'trees', target: 12, label: 'Grow 12 trees across Arboria.' }),
  Object.freeze({ type: 'territory', target: 25, label: 'Discover new coasts and claim 25 cells.' }),
  Object.freeze({ type: 'trees', target: 35, label: 'Establish a forest of 35 trees.' }),
  Object.freeze({ type: 'vitality', target: 60, label: 'Reach 60% planet vitality.' }),
]);

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const copy = (value) => structuredClone(value);

function normalize(v) {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}
function midpoint(a, b) { return normalize([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]); }
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function generatePlanet(seed = 76123) {
  const phi = (1 + Math.sqrt(5)) / 2;
  let vertices = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map(normalize);
  let faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];
  for (let sub = 0; sub < 3; sub += 1) {
    const cache = new Map();
    const middle = (a, b) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (cache.has(key)) return cache.get(key);
      vertices.push(midpoint(vertices[a], vertices[b]));
      const id = vertices.length - 1;
      cache.set(key, id);
      return id;
    };
    const next = [];
    for (const [a,b,c] of faces) {
      const ab = middle(a,b), bc = middle(b,c), ca = middle(c,a);
      next.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
    }
    faces = next;
  }
  if (vertices.length !== 642) throw new Error(`Expected 642 planet vertices, got ${vertices.length}`);
  const neighborSets = vertices.map(() => new Set());
  for (const [a,b,c] of faces) {
    neighborSets[a].add(b); neighborSets[a].add(c);
    neighborSets[b].add(a); neighborSets[b].add(c);
    neighborSets[c].add(a); neighborSets[c].add(b);
  }
  const isWater = (normal) => {
    const x = normal[0] * 2.8, y = normal[1] * 2.8, z = normal[2] * 2.8;
    const wave1 = Math.sin(x) * Math.cos(y) + Math.sin(y * 1.5 + z) * 0.5;
    const wave2 = Math.cos(z * 2.1 + x * 0.7) * 0.4 + Math.sin(x * 3.2 - y * 2.0) * 0.25;
    return wave1 + wave2 < -0.22;
  };
  const cells = vertices.map((normal, id) => ({
    id,
    normal: normal.map(round6),
    neighbors: [...neighborSets[id]].sort((a,b) => a-b),
    isWater: isWater(normal),
    isPentagon: neighborSets[id].size === 5,
    unlocked: false,
    restoration: 0,
    treeId: null,
  }));
  const candidates = cells.filter(c => !c.isWater && c.neighbors.filter(id => !cells[id].isWater).length >= 2);
  const rng = mulberry32(seed ^ 0xA8B0_91A5);
  const first = candidates[Math.floor(rng() * candidates.length)] ?? candidates[0];
  const start = [first.id];
  for (const id of first.neighbors) if (!cells[id].isWater && start.length < 3) start.push(id);
  if (start.length < 3) {
    for (const id of cells[start[1]].neighbors) if (!cells[id].isWater && !start.includes(id) && start.length < 3) start.push(id);
  }
  if (start.length !== 3) throw new Error('Could not establish three starting cells');
  for (const id of start) cells[id].unlocked = true;
  return { cells, faces, startingCells: start, landCount: cells.filter(c => !c.isWater).length };
}

function missionValue(state, mission) {
  if (mission.type === 'trees') return state.trees.length;
  if (mission.type === 'territory') return state.cells.reduce((n,c) => n + Number(c.unlocked), 0);
  if (mission.type === 'vitality') return state.vitality;
  return 0;
}
function diversity(state) { return new Set(state.trees.map(t => t.species)).size; }
function vitalityOf(state) {
  const claimedLand = state.cells.filter(c => c.unlocked && !c.isWater);
  if (!claimedLand.length) return 0;
  return round6(claimedLand.reduce((sum,c) => sum + c.restoration, 0) / claimedLand.length * 100);
}
function scoreOf(state) {
  const territory = state.cells.reduce((n,c) => n + Number(c.unlocked), 0);
  const masteryBonus = state.resultReason === 'mastery' ? Math.max(0, Math.floor((SESSION_SECONDS - state.elapsed) * 20)) : 0;
  return Math.floor(territory * 100 + state.trees.length * 150 + state.vitality * 50 + state.missionIndex * 1000 + diversity(state) * 500 + masteryBonus);
}
function canClaim(state, cellId) {
  const cell = state.cells[cellId];
  return !!cell && !cell.unlocked && cell.neighbors.some(id => state.cells[id].unlocked);
}
function pushEvent(state, type, message, extra = {}) {
  state.events.push({ type, message, at: round6(state.elapsed), ...extra });
  if (state.events.length > 40) state.events.splice(0, state.events.length - 40);
}
function green(state, cellId, amount) {
  if (state.__frozen?.includes('restoration')) return;
  const cell = state.cells[cellId];
  if (!cell || !cell.unlocked || cell.isWater) return;
  cell.restoration = round6(clamp(cell.restoration + amount, 0, 1));
  for (const neighborId of cell.neighbors) {
    const n = state.cells[neighborId];
    if (n.unlocked && !n.isWater) n.restoration = round6(clamp(n.restoration + amount * 0.4, 0, 1));
  }
}
function updateDerived(state) {
  state.vitality = vitalityOf(state);
  state.score = scoreOf(state);
}
function checkMissions(state) {
  if (state.__frozen?.includes('objectives')) return false;
  let advanced = false;
  while (state.missionIndex < MISSIONS.length) {
    const mission = MISSIONS[state.missionIndex];
    if (missionValue(state, mission) + 1e-9 < mission.target) break;
    state.missionIndex += 1;
    state.energy += MISSION_REWARD;
    pushEvent(state, 'mission', `Mission ${state.missionIndex} complete · +${MISSION_REWARD} Sun Energy`, { mission: state.missionIndex });
    advanced = true;
  }
  updateDerived(state);
  if (state.missionIndex >= MISSIONS.length && state.mode === 'play') finish(state, 'mastery');
  return advanced;
}
function finish(state, reason) {
  state.resultReason = reason;
  state.mode = 'result';
  updateDerived(state);
  if (state.score > state.best.score) state.best.score = state.score;
  if (state.vitality > state.best.vitality) state.best.vitality = state.vitality;
  if (reason === 'mastery' && (state.best.masterySeconds === null || state.elapsed < state.best.masterySeconds)) state.best.masterySeconds = round6(state.elapsed);
  pushEvent(state, reason === 'mastery' ? 'mastery' : 'timeout', reason === 'mastery' ? 'Arboria restored!' : 'Restoration window closed.');
}

export function createArboriaGame({ seed = 76123, best = {}, freeze = [] } = {}) {
  const frozen = new Set(freeze);
  const allowedFrozen = new Set(['territory','resource','vegetation','weather','restoration','objectives']);
  if ([...frozen].some(id => !allowedFrozen.has(id))) throw new Error('Unknown frozen domain');
  const baseline = () => {
    const planet = generatePlanet(seed);
    const state = {
      schema: 'arboria-runtime/1', nexus: { domainPath: 'n:arcade:arboria', graphVersion: 1 }, __frozen: [...frozen], seed, mode: 'title', elapsed: 0,
      sessionSeconds: SESSION_SECONDS, energy: 120, selectedSpecies: 0,
      selectedCell: planet.startingCells[0], rainRemaining: 0, missionIndex: 0,
      vitality: 0, score: 0, resultReason: null, nextTreeId: 1,
      best: { score: Number(best.score) || 0, vitality: Number(best.vitality) || 0, masterySeconds: Number.isFinite(best.masterySeconds) ? best.masterySeconds : null },
      startingCells: [...planet.startingCells], landCount: planet.landCount,
      cells: planet.cells, trees: [], events: [],
    };
    updateDerived(state);
    return state;
  };
  let state = baseline();
  const ensurePlay = () => state.mode === 'play';
  const select = (cellId) => {
    if (!Number.isInteger(cellId) || cellId < 0 || cellId >= state.cells.length) return false;
    state.selectedCell = cellId; return true;
  };
  const claim = (cellId = state.selectedCell) => {
    if (!ensurePlay()) return false;
    if (frozen.has('territory')) { pushEvent(state, 'ablation', 'Territory domain frozen.'); return false; }
    const cell = state.cells[cellId];
    if (!cell) return false;
    if (cell.unlocked) { pushEvent(state, 'reject', 'Territory already claimed.'); return false; }
    if (!canClaim(state, cellId)) { pushEvent(state, 'reject', 'Claim a cell next to your territory.'); return false; }
    if (state.energy < CLAIM_COST) { pushEvent(state, 'reject', `Need ${CLAIM_COST} Sun Energy to claim territory.`); return false; }
    if (frozen.has('resource')) { pushEvent(state, 'ablation', 'Resource domain frozen.'); return false; }
    state.energy -= CLAIM_COST; cell.unlocked = true;
    pushEvent(state, 'claim', cell.isWater ? 'Coast discovered.' : 'Territory claimed.', { cellId });
    updateDerived(state); checkMissions(state); return true;
  };
  const plant = (cellId = state.selectedCell, speciesId = SPECIES[state.selectedSpecies].id) => {
    if (!ensurePlay()) return false;
    if (frozen.has('vegetation')) { pushEvent(state, 'ablation', 'Vegetation domain frozen.'); return false; }
    const cell = state.cells[cellId], species = SPECIES.find(s => s.id === speciesId);
    if (!cell || !species) return false;
    if (!cell.unlocked) { pushEvent(state, 'reject', 'Claim this territory first.'); return false; }
    if (cell.isWater) { pushEvent(state, 'reject', 'Trees cannot take root in ocean cells.'); return false; }
    if (cell.treeId !== null) { pushEvent(state, 'reject', 'This cell already has a tree.'); return false; }
    if (state.energy < species.cost) { pushEvent(state, 'reject', `Need ${species.cost} Sun Energy for ${species.name}.`); return false; }
    if (frozen.has('resource')) { pushEvent(state, 'ablation', 'Resource domain frozen.'); return false; }
    state.energy -= species.cost;
    const tree = { id: state.nextTreeId++, cellId, species: species.id, growth: 0.04, hydration: 1, energyClock: 0 };
    state.trees.push(tree); cell.treeId = tree.id; green(state, cellId, 0.7);
    pushEvent(state, 'plant', `${species.name} planted.`, { cellId, treeId: tree.id, species: species.id });
    updateDerived(state); checkMissions(state); return true;
  };
  const water = (cellId = state.selectedCell) => {
    if (!ensurePlay()) return false;
    if (frozen.has('restoration')) { pushEvent(state, 'ablation', 'Restoration domain frozen.'); return false; }
    const cell = state.cells[cellId];
    if (!cell) return false;
    if (!cell.unlocked) { pushEvent(state, 'reject', 'Territory is locked.'); return false; }
    if (cell.isWater) { pushEvent(state, 'reject', 'The ocean needs no watering.'); return false; }
    green(state, cellId, 0.65);
    const area = new Set([cellId, ...cell.neighbors]);
    let nourished = 0;
    for (const tree of state.trees) if (area.has(tree.cellId)) { tree.hydration = round6(clamp(tree.hydration + 0.8, 0, 2.5)); tree.growth = round6(clamp(tree.growth + 0.08, 0, 1)); nourished += 1; }
    if (nourished) state.energy += nourished * 4;
    pushEvent(state, 'water', nourished ? `Watered ${nourished} tree${nourished === 1 ? '' : 's'} · +${nourished * 4} Sun Energy` : 'Soil refreshed.', { cellId, nourished });
    updateDerived(state); checkMissions(state); return true;
  };
  const rain = () => {
    if (!ensurePlay()) return false;
    if (frozen.has('weather')) { pushEvent(state, 'ablation', 'Weather domain frozen.'); return false; }
    if (state.rainRemaining > 0) { pushEvent(state, 'reject', 'Rainstorm already active.'); return false; }
    if (state.energy < RAIN_COST) { pushEvent(state, 'reject', `Need ${RAIN_COST} Sun Energy for rain.`); return false; }
    if (frozen.has('resource')) { pushEvent(state, 'ablation', 'Resource domain frozen.'); return false; }
    state.energy -= RAIN_COST; state.rainRemaining = RAIN_SECONDS;
    pushEvent(state, 'rain', 'A life-giving rainstorm sweeps across Arboria.'); updateDerived(state); return true;
  };
  const primary = () => {
    const cell = state.cells[state.selectedCell];
    if (!cell) return false;
    return cell.unlocked ? plant(cell.id) : claim(cell.id);
  };
  const cycleSpecies = (direction = 1) => {
    const step = Number.isFinite(direction) ? Math.trunc(direction) : 1;
    state.selectedSpecies = ((state.selectedSpecies + step) % SPECIES.length + SPECIES.length) % SPECIES.length;
    pushEvent(state, 'species', `${SPECIES[state.selectedSpecies].name} selected.`, { species: SPECIES[state.selectedSpecies].id });
    return true;
  };
  const step = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) throw new Error('Invalid step interval');
    if (state.mode !== 'play' || seconds === 0) return snapshot();
    let remaining = seconds;
    while (remaining > 1e-9 && state.mode === 'play') {
      const dt = Math.min(0.05, remaining, SESSION_SECONDS - state.elapsed);
      if (dt <= 0) { finish(state, 'timeout'); break; }
      state.elapsed = round6(state.elapsed + dt);
      if (state.rainRemaining > 0 && !frozen.has('weather')) {
        state.rainRemaining = round6(Math.max(0, state.rainRemaining - dt));
        for (const tree of state.trees) tree.hydration = round6(clamp(tree.hydration + dt * 0.5, 0, 2.5));
        for (const cell of state.cells) if (cell.unlocked && !cell.isWater && (cell.treeId !== null || cell.restoration > 0)) cell.restoration = round6(clamp(cell.restoration + dt * 0.08, 0, 1));
      }
      let generated = 0;
      for (const tree of state.trees) {
        if (frozen.has('vegetation')) continue;
        tree.growth = round6(clamp(tree.growth + dt * 0.12 * tree.hydration, 0, 1));
        tree.energyClock += dt;
        if (tree.energyClock + 1e-9 >= ENERGY_INTERVAL) {
          const cycles = Math.floor((tree.energyClock + 1e-9) / ENERGY_INTERVAL);
          tree.energyClock -= cycles * ENERGY_INTERVAL;
          const spec = SPECIES.find(s => s.id === tree.species);
          const coastal = state.cells[tree.cellId].neighbors.some(id => state.cells[id].isWater && state.cells[id].unlocked);
          generated += cycles * (spec.yield + Number(coastal));
        }
      }
      if (generated && !frozen.has('resource')) state.energy += generated;
      updateDerived(state); checkMissions(state);
      if (state.elapsed >= SESSION_SECONDS - 1e-9 && state.mode === 'play') finish(state, 'timeout');
      remaining -= dt;
    }
    return snapshot();
  };
  const start = () => { if (state.mode === 'title' || state.mode === 'result') { if (state.mode === 'result') { const saved = copy(state.best); state = baseline(); state.best = saved; } state.mode = 'play'; pushEvent(state, 'start', 'Restoration run started.'); } return snapshot(); };
  const pause = () => { if (state.mode === 'play') state.mode = 'pause'; else if (state.mode === 'pause') state.mode = 'play'; return snapshot(); };
  const reset = () => { const saved = copy(state.best); state = baseline(); state.best = saved; return snapshot(); };
  const action = (type, payload = {}) => {
    if (type === 'select') return select(payload.cellId);
    if (type === 'primary') return primary();
    if (type === 'claim') return claim(payload.cellId);
    if (type === 'plant') return plant(payload.cellId, payload.species);
    if (type === 'water') return water(payload.cellId);
    if (type === 'rain') return rain();
    if (type === 'cycle-species') return cycleSpecies(payload.direction ?? 1);
    if (type === 'pause') return pause();
    throw new Error(`Unknown action ${type}`);
  };
  function snapshot() {
    const s = copy(state); delete s.__frozen;
    s.unlockedCount = s.cells.reduce((n,c) => n + Number(c.unlocked), 0);
    s.species = SPECIES.map(x => ({...x}));
    s.missions = MISSIONS.map((m,index) => ({...m, complete: index < s.missionIndex, current: missionValue(state,m)}));
    s.currentMission = s.missionIndex < MISSIONS.length ? {...MISSIONS[s.missionIndex], current: missionValue(state,MISSIONS[s.missionIndex])} : null;
    s.selectedSpeciesId = SPECIES[s.selectedSpecies].id;
    s.raining = s.rainRemaining > 0;
    s.remaining = round6(Math.max(0, SESSION_SECONDS - s.elapsed));
    return s;
  }
  return { start, pause, reset, step, action, select, snapshot, constants: { SESSION_SECONDS, RAIN_SECONDS, RAIN_COST, CLAIM_COST, ENERGY_INTERVAL, MISSION_REWARD, SPECIES, MISSIONS } };
}

export const ARBORIA_CONSTANTS = Object.freeze({ SESSION_SECONDS, RAIN_SECONDS, RAIN_COST, CLAIM_COST, ENERGY_INTERVAL, MISSION_REWARD, SPECIES, MISSIONS });
