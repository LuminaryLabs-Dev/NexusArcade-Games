/** Pure, game-local stage state. This is intentionally independent of rendering/input. */
export const START = Object.freeze({ x: 0, y: 0.42, z: 9 });
export const CHECKPOINTS = Object.freeze([
  { id: 'start', position: START },
  { id: 'fan-deck', position: { x: 0, y: 0.42, z: -8 } },
  { id: 'control-shelf', position: { x: 0, y: 0.42, z: -15 } }
]);

export function createStageState() {
  return {
    position: { ...START }, velocity: { x: 0, y: 0, z: 0 }, grounded: true,
    stage: 'crossing', checkpoint: 'start', fuse: 'missing', fanOn: false,
    scrap: 0, scrapTaken: false, tether: null, magnetProgress: 0,
    elapsed: 0, cleared: false, fallCount: 0, lastCue: 'work-order'
  };
}

export function checkpointPosition(id) {
  return { ...(CHECKPOINTS.find((item) => item.id === id) ?? CHECKPOINTS[0]).position };
}

export function transition(state, next, cue = next) {
  state.stage = next;
  state.lastCue = cue;
  return state;
}

/** Validates/progresses semantic actions. Position and collision are advanced separately by stepStage. */
export function applyStageAction(state, action = {}) {
  if (state.cleared && action.type !== 'retry') return state;
  if (action.type === 'retry') return createStageState();
  if (action.type === 'swing' && state.stage === 'crossing' && action.nearAnchor && !state.tether) {
    state.tether = { from: { ...state.position }, to: { x: 0, y: 0.42, z: -3.6 }, time: 0, duration: 0.85 };
    state.lastCue = 'tether-start';
  }
  if (action.type === 'retrieve-fuse' && state.stage === 'fan-mechanism' && action.aimed && isNearFuse(state.position)) {
    state.magnetProgress = Math.min(1.25, state.magnetProgress + Math.max(0, action.dt ?? 0));
    if (state.magnetProgress >= 1.25) {
      state.fuse = 'recovered';
      state.stage = 'install-fuse';
      state.lastCue = 'fuse-recovered';
    }
  }
  if (action.type === 'interact') {
    if (state.stage === 'install-fuse' && action.target === 'control' && action.near && state.fuse === 'recovered') {
      state.fuse = 'installed'; state.fanOn = true; state.checkpoint = 'control-shelf';
      state.stage = 'glide'; state.lastCue = 'fan-repaired';
    } else if (action.target === 'scrap' && !state.scrapTaken && action.near) {
      state.scrap += 1; state.scrapTaken = true; state.lastCue = 'scrap';
    }
  }
  if (action.type === 'checkpoint' && CHECKPOINTS.some((point) => point.id === action.id)) {
    state.checkpoint = action.id;
  }
  return state;
}

export const STAGE_PLATFORMS = Object.freeze([
  { x: 0, z: 9, w: 5.6, d: 5.4 },     // start desk mat
  { x: 0, z: 4.1, w: 3.2, d: 2.0 },  // book stack
  { x: 0, z: 0.8, w: 2.8, d: 2.0 },  // ruler bridge
  { x: 0, z: -3.9, w: 3.4, d: 2.6 }, // landing after cable
  { x: 0, z: -8.5, w: 5.0, d: 6.5 }, // fan deck
  { x: 0, z: -14.7, w: 5.2, d: 5.0 },
  { x: 0, z: -20.8, w: 5.4, d: 4.0 } // battery shelf
]);

function floorAt(x, z) {
  for (const p of STAGE_PLATFORMS) if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) return 0.42;
  return null;
}

export function isNearFuse(position) {
  return Math.hypot(position.x - 0.25, position.z + 12.9) <= 3.2 && Math.abs(position.y - 1.45) <= 3.2;
}

export function isInAirflowCorridor(position) {
  return Math.abs(position.x) <= 2.2 && position.z <= -15 && position.z >= -23;
}

export function isOnBatteryShelf(position) {
  const shelf = STAGE_PLATFORMS.at(-1);
  return Math.abs(position.x - shelf.x) <= shelf.w / 2 && Math.abs(position.z - shelf.z) <= shelf.d / 2 && position.y <= 0.65;
}

/** Deterministic fixed-step movement; bounded game-local platform/gravity rules, no physics provider. */
export function stepStage(state, input = {}, dt = 1 / 60) {
  if (state.cleared) return state;
  const previousY = state.position.y;
  const numericDt = Number(dt);
  const delta = Number.isFinite(numericDt) ? Math.min(Math.max(numericDt, 0), 1 / 20) : 1 / 60;
  state.elapsed += delta;
  const rawX = Number(input.x ?? 0), rawZ = Number(input.z ?? 0);
  const moveX = Number.isFinite(rawX) ? Math.max(-1, Math.min(1, rawX)) : 0;
  const moveZ = Number.isFinite(rawZ) ? Math.max(-1, Math.min(1, rawZ)) : 0;
  const glideAllowed = input.glide === true && state.fanOn && isInAirflowCorridor(state.position);
  const mag = Math.hypot(moveX, moveZ) || 1;
  const speed = glideAllowed ? 4.9 : 3.1;
  state.position.x += (moveX / mag) * speed * delta;
  state.position.z += (moveZ / mag) * speed * delta;
  if (input.jump && state.grounded) { state.velocity.y = 4.8; state.grounded = false; }
  if (glideAllowed) {
    state.velocity.y = state.position.y < 2.3 ? Math.max(state.velocity.y, 1.8) : Math.min(state.velocity.y, 0);
    state.grounded = false;
  }
  state.velocity.y -= 10.5 * delta;
  state.position.y += state.velocity.y * delta;

  if (state.tether) {
    state.tether.time += delta;
    const t = Math.min(1, state.tether.time / state.tether.duration);
    const arc = Math.sin(t * Math.PI) * 1.7;
    state.position.x = state.tether.from.x + (state.tether.to.x - state.tether.from.x) * t;
    state.position.z = state.tether.from.z + (state.tether.to.z - state.tether.from.z) * t;
    state.position.y = 0.42 + arc;
    if (t >= 1) { state.tether = null; state.velocity.y = 0; }
  }

  const floor = floorAt(state.position.x, state.position.z);
  if (floor !== null && previousY >= floor - 0.025 && state.position.y <= floor && state.velocity.y <= 0) {
    state.position.y = floor; state.velocity.y = 0; state.grounded = true;
  } else state.grounded = false;

  if (state.position.y < -3) {
    state.fallCount += 1; state.position = checkpointPosition(state.checkpoint);
    state.velocity = { x: 0, y: 0, z: 0 }; state.grounded = true; state.tether = null;
    state.lastCue = 'checkpoint-return';
  }

  if (state.stage === 'crossing' && state.position.z <= -6.4) {
    state.stage = 'fan-mechanism'; state.checkpoint = 'fan-deck'; state.lastCue = 'fan-entered';
  }
  if (state.fanOn && state.stage === 'glide' && state.grounded && isOnBatteryShelf(state.position)) {
    state.stage = 'finish'; state.cleared = true; state.lastCue = 'stage-clear';
  }
  return state;
}

export function isNearAnchor(position) { return Math.hypot(position.x, position.z - 1.2) < 2.4; }
export function isNearControl(position) { return Math.hypot(position.x, position.z + 14.7) < 2.1; }
