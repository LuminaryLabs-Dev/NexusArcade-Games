import * as THREE from './three-runtime.mjs';
import { createEngine,createAuthoringDomain } from './engine-runtime.mjs';
import { createStageState, applyStageAction, stepStage, isNearAnchor, isNearControl, isNearFuse, isInAirflowCorridor } from './stage-state.mjs';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#view');
const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
if (!context) throw new Error('This tiny workbench needs WebGL 2.');
const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c5d8d3');
scene.fog = new THREE.Fog('#c5d8d3', 28, 68);
const camera = new THREE.PerspectiveCamera(57, 1, 0.1, 100);
const ambient = new THREE.HemisphereLight('#edfff5', '#61534a', 2.0); scene.add(ambient);
const sun = new THREE.DirectionalLight('#fff1d0', 3.2); sun.position.set(-8, 18, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);

const engine = createEngine({ kits: createAuthoringDomain() });
const project = engine.n.authoringProject;
const stageGroup = new THREE.Group(); scene.add(stageGroup);
const robot = new THREE.Group(); scene.add(robot);
let yaw = 0, pitch = -0.16, dragging = false, aiming = false, previous = null;
const keyState = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = createStageState();
let audioContext = null;

const palette = {
  desk: '#72543d', paper: '#ead9b5', book: '#c65d48', book2: '#477b75', brass: '#daa95b',
  metal: '#9eaaa6', dark: '#34484a', fan: '#617f78', blue: '#8fc6bf', glow: '#f6d879'
};
const materials = Object.fromEntries(Object.entries(palette).map(([k, color]) => [k, new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: k === 'brass' || k === 'metal' ? 0.52 : 0.06 })]));

// Each prop begins as an actual mesh.cube source document in NexusEngine Authoring.
async function authoredBox(id, size, material, position, rotation = [0, 0, 0]) {
  if (disposed) return null;
  const epoch = project.context().epoch;
  const receipt = project.execute({ requestId: `salvage-${id}`, epoch, operations: [{ id: 'mesh.cube', args: { id, size: 1 } }] });
  if (receipt?.status !== 'completed') throw new Error(`Authoring rejected ${id}`);
  const doc = project.getDocument(id);
  if (!doc?.content?.vertices?.length || !doc?.content?.faces?.length) throw new Error(`Authoring produced no mesh for ${id}`);
  const positions = [], indices = [];
  for (const face of doc.content.faces) {
    const base = positions.length / 3;
    for (const ref of face.vertices) {
      const v = doc.content.vertices.find((vertex) => vertex.id === ref);
      positions.push(...v.position);
    }
    for (let i = 1; i < face.vertices.length - 1; i++) indices.push(base, base + i, base + i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, materials[material]);
  mesh.name = id; mesh.scale.set(...size); mesh.position.set(...position); mesh.rotation.set(...rotation); mesh.castShadow = true; mesh.receiveShadow = true;
  stageGroup.add(mesh);
  return mesh;
}

function buildRobot() {
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: '#e0b84f', roughness: 0.42, metalness: 0.4 }));
  shell.position.y = 0.2; shell.castShadow = true; robot.add(shell);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), new THREE.MeshStandardMaterial({ color: '#aef7ed', emissive: '#2c9687', emissiveIntensity: 0.7 }));
  eye.position.set(0, 0.25, -0.22); robot.add(eye);
  for (const x of [-0.17, 0.17]) { const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 8), materials.dark); foot.position.set(x, -0.03, 0); robot.add(foot); }
  const lamp = new THREE.PointLight('#9fffe5', 1.6, 3); lamp.position.set(0, 0.5, -0.2); robot.add(lamp);
}

async function assembleWorkbench() {
  const box = (id, size, mat, p, r) => authoredBox(id, size, mat, p, r);
  // Deep lower bench is a visible bottom far below the fatal-drop threshold.
  await box('deep-bench-bottom', [40, 0.35, 58], 'dark', [0, -5.65, -5]);
  await box('starting-pad', [5.6, 0.8, 5.4], 'paper', [0, 0, 9]);
  await box('book-platform', [3.2, 0.82, 2], 'book', [0, 0, 4.1]);
  await box('ruler-platform', [2.8, 0.32, 2], 'brass', [0, 0.16, 0.8]);
  await box('cable-landing', [3.4, 0.8, 2.6], 'paper', [0, 0, -3.9]);
  await box('fan-deck', [5, 0.8, 6.5], 'book2', [0, 0, -8.5]);
  await box('control-shelf', [5.2, 0.8, 5], 'paper', [0, 0, -14.7]);
  await box('battery-shelf', [5.4, 0.8, 4], 'book2', [0, 0, -20.8]);
  await box('book-stack-a', [4.5, 1.1, 3.1], 'book2', [-6, 0.55, 8]);
  await box('book-stack-b', [4.3, 0.8, 2.7], 'book', [6, 0.4, 5]);
  // Twin ruler rails, graduations, pencil and cable anchor provide scale and navigation cues.
  await box('ruler-rail-left', [0.16, 0.28, 5], 'brass', [-1.2, 0.55, 2]);
  await box('ruler-rail-right', [0.16, 0.28, 5], 'brass', [1.2, 0.55, 2]);
  for (let i = 0; i < 10; i++) await box(`ruler-tick-${i}`, [0.09, 0.03, 0.12 + (i % 5 === 0 ? 0.18 : 0)], 'dark', [0.9, 0.72, 4.15 - i * 0.48]);
  await box('pencil', [0.28, 0.28, 10], 'book', [8, 0.9, -1], [0, 0, -0.03]);
  await box('cable-anchor', [0.55, 0.55, 0.35], 'brass', [0, 2.5, 1.2]);
  const cablePath = new THREE.CatmullRomCurve3([new THREE.Vector3(0,2.5,1.2),new THREE.Vector3(0,2.25,0),new THREE.Vector3(0,1.8,-1.5),new THREE.Vector3(0,1.1,-2.7),new THREE.Vector3(0,0.42,-3.6)]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cablePath, 24, 0.045, 7, false), materials.brass); cable.name = 'grapple-cable'; stageGroup.add(cable);
  // Fan is deliberately stationary: repaired airflow is represented by changing lighting/streamer animation.
  await box('fan-base', [4.1, 1.1, 1], 'metal', [0, 0.85, -10.7]);
  await box('fan-neck', [0.48, 3.3, 0.48], 'metal', [0, 2.9, -10.7]);
  await box('fan-housing', [4.9, 4.9, 1.1], 'fan', [0, 5.1, -10.7]);
  await box('fan-grille', [4.2, 4.2, 0.16], 'metal', [0, 5.1, -10.05]);
  await box('fuse-pedestal', [1.1, 0.65, 0.9], 'dark', [0, 0.72, -12.9]);
  await box('fuse-canister', [0.28, 0.82, 0.28], 'glow', [0.25, 1.45, -12.9]);
  await box('control-panel', [2, 0.55, 0.5], 'metal', [0, 1.0, -14.7]);
  await box('fuse-slot', [0.38, 0.18, 0.12], 'dark', [0, 1.36, -14.4]);
  await box('battery', [1.6, 1.2, 1.1], 'glow', [0, 1.1, -20.8]);
  await box('finish-ring', [2.7, 0.08, 2.7], 'brass', [0, 0.45, -20.8]);
}

function cue() {
  if (!audioContext || !soundEnabled) return;
  const osc = audioContext.createOscillator(), gain = audioContext.createGain();
  osc.type = 'sine'; osc.frequency.value = state.lastCue === 'stage-clear' ? 880 : 540;
  gain.gain.setValueAtTime(0.055, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.16);
  osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + 0.17);osc.onended=()=>{osc.disconnect();gain.disconnect();};
}

function stageText() {
  if (state.cleared) return 'BATTERY RESTORED · WORK ORDER COMPLETE';
  return ({ crossing: 'Cross the books and ruler · find the brass cable eyelet', 'fan-mechanism': 'Retrieve the loose fuse · steady the magnetic sight', 'install-fuse': 'Fuse recovered · reach the safe control panel', glide: 'Fan repaired · ride the airflow to the battery' })[state.stage];
}
function targetHint() {
  if (state.stage === 'crossing' && isNearAnchor(state.position)) return 'Hold E to swing across the gap';
  if (state.stage === 'fan-mechanism') return isNearFuse(state.position)
    ? `Hold right mouse to center the fuse, then hold Q · ${(Math.min(1,state.magnetProgress/1.25)*100)|0}%`
    : 'Move closer to the loose fuse on its pedestal';
  if (state.stage === 'install-fuse' && isNearControl(state.position)) return 'Press E to install the fuse';
  if (state.stage === 'glide') return 'Move toward the glowing battery · hold Space to glide';
  return 'WASD move · Space jump · E interact · R restart work order';
}

const magnet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff0a4', emissive: '#ffa929', emissiveIntensity: 1.8 }));
magnet.position.set(0.25, 1.45, -12.9); scene.add(magnet);
const fanGlow = new THREE.PointLight('#a7fff0', 0, 14); fanGlow.position.set(0, 5.1, -10.7); scene.add(fanGlow);
const airflow = new THREE.Group(); scene.add(airflow);
for (let i=0;i<6;i++) { const strand = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 4.4), new THREE.MeshBasicMaterial({ color: '#a4f6e6', transparent: true, opacity: 0.5 })); strand.position.set(-1.3+i*0.52, 2.0+i*0.26, -15.8); airflow.add(strand); }
buildRobot();

function resize() { const w = Math.max(1,canvas.clientWidth), h = Math.max(1,canvas.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
const removers = [];
function listen(target, type, handler, options) { target.addEventListener(type, handler, options); removers.push(() => target.removeEventListener(type, handler, options)); }
const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
listen(window,'keydown', (e) => { keyState.add(e.code); if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); if (e.code === 'KeyR') { state = applyStageAction(state, { type: 'retry' }); updateUI(true); } });
listen(window,'keyup', (e) => keyState.delete(e.code));
listen(window,'blur',()=>{keyState.clear();dragging=false;aiming=false;previous=null;});
listen(document,'visibilitychange',()=>{if(document.hidden){keyState.clear();dragging=false;aiming=false;previous=null;}});
listen(canvas,'pointerdown', (e) => { dragging = true; aiming = e.button === 2; previous = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
listen(canvas,'pointerup', () => { dragging = false; aiming = false; previous = null; });
listen(canvas,'pointercancel', () => { dragging = false; aiming = false; previous = null; });
listen(canvas,'contextmenu', (e) => e.preventDefault());
listen(canvas,'pointermove', (e) => {
  if (!dragging || !previous) return;
  const rawX=e.clientX-previous[0], rawY=e.clientY-previous[1]; previous=[e.clientX,e.clientY];
  const dx=Number.isFinite(rawX)?Math.max(-500,Math.min(500,rawX)):0, dy=Number.isFinite(rawY)?Math.max(-500,Math.min(500,rawY)):0;
  yaw -= dx*0.004; pitch=Math.max(-0.7,Math.min(0.42,pitch-dy*0.003));
});
let soundEnabled = false;
listen($('#sound'),'click', async () => {
  soundEnabled = !soundEnabled;
  if (soundEnabled) { audioContext ??= new AudioContext(); await audioContext.resume(); }
  else if (audioContext?.state === 'running') await audioContext.suspend();
  $('#sound').textContent = soundEnabled ? '♪ Sound on' : '♪ Sound off';
  $('#sound').setAttribute('aria-pressed', String(soundEnabled));
});
listen($('#start'),'click', async () => { $('#intro').hidden = true; $('#hud').hidden = false; audioContext ??= new AudioContext(); if (soundEnabled) await audioContext.resume(); });
listen($('#again'),'click', () => { state = applyStageAction(state, { type: 'retry' }); $('#clear').hidden = true; $('#hud').hidden = false; updateUI(true); });

function updateUI(force = false) {
  $('#objective').textContent = stageText();
  $('#hint').textContent = targetHint();
  $('#scrap').textContent = `${state.scrap} scrap`;
  $('#checkpoint').textContent = `Checkpoint: ${state.checkpoint === 'start' ? 'desk mat' : state.checkpoint === 'fan-deck' ? 'fan deck' : 'control shelf'}`;
  $('#time').textContent = `${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2,'0')}`;
  $('#magfill').style.width = `${Math.min(100, state.magnetProgress / 1.25 * 100)}%`;
  $('#clear').hidden = !state.cleared;
  if (state.cleared) $('#finalScrap').textContent = `Optional scrap recovered: ${state.scrap}`;
  $('#install').hidden = state.fuse !== 'recovered';
  if (state.lastCue && state.lastCue !== updateUI.cue) { updateUI.cue = state.lastCue; cue(); }
}
function interact() {
  if (keyState.has('KeyE')) {
    if (isNearAnchor(state.position) && state.stage === 'crossing') state = applyStageAction(state, { type: 'swing', nearAnchor: true });
    if (isNearControl(state.position)) state = applyStageAction(state, { type: 'interact', target: 'control', near: true });
  }
  if (!state.scrapTaken && Math.hypot(state.position.x + 2.2, state.position.z + 8.4) < 1.0 && keyState.has('KeyE')) state = applyStageAction(state, { type: 'interact', target: 'scrap', near: true });
}
let previousFrame = performance.now(), uiFrame = 0;
let frameHandle = null, disposed = false;
function cleanup() {
  if (disposed) return;
  disposed = true;
  if (frameHandle !== null) cancelAnimationFrame(frameHandle);
  observer.disconnect(); keyState.clear();
  for (const remove of removers.splice(0)) remove();
  scene.traverse((object) => { object.geometry?.dispose?.(); if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose?.()); else object.material?.dispose?.(); });
  renderer.dispose(); renderer.forceContextLoss();
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
}
listen(window,'pagehide', cleanup, { once: true });
function frame(now) {
  const rawDt = (now - previousFrame) / 1000;
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt,0),1/20) : 1/60; previousFrame = now;
  if (disposed) return;
  if (!$('#intro').hidden) { frameHandle = requestAnimationFrame(frame); return; }
  if (document.visibilityState === 'visible') {
    document.body.classList.toggle('aiming', aiming && state.stage === 'fan-mechanism');
    engine.tick(dt);
    const axes = { x: Number(keyState.has('KeyD') || keyState.has('ArrowRight')) - Number(keyState.has('KeyA') || keyState.has('ArrowLeft')), z: Number(keyState.has('KeyS') || keyState.has('ArrowDown')) - Number(keyState.has('KeyW') || keyState.has('ArrowUp')) };
    const gliding = state.fanOn && keyState.has('Space') && isInAirflowCorridor(state.position);
    state = stepStage(state, { ...axes, jump: keyState.has('Space') && !gliding, glide: gliding }, dt);
    interact();
    if (state.stage === 'install-fuse' && Math.abs(state.position.z + 8.5) < 3.2) state = applyStageAction(state, { type: 'checkpoint', id: 'fan-deck' });
    robot.position.set(state.position.x, state.position.y, state.position.z);
    robot.rotation.y = yaw;
    const target = new THREE.Vector3(state.position.x + Math.sin(yaw) * 9, state.position.y + 5.2, state.position.z + Math.cos(yaw) * 9);
    camera.position.lerp(target, reducedMotion ? 0.2 : 0.12);
    if (state.stage === 'fan-mechanism') camera.lookAt(magnet.position.x + Math.sin(yaw) * 2, magnet.position.y + Math.sin(pitch + 0.16) * 2, magnet.position.z);
    else camera.lookAt(state.position.x, state.position.y + 0.8, state.position.z);
    camera.updateMatrixWorld();
    const sight = new THREE.Raycaster(); sight.setFromCamera(new THREE.Vector2(0,0), camera);
    const distanceToFuse = robot.position.distanceTo(magnet.position);
    const aligned = isNearFuse(state.position) && distanceToFuse <= 4.1 && sight.ray.distanceToPoint(magnet.position) <= 0.42;
    if (keyState.has('KeyQ') && aiming && aligned && state.stage === 'fan-mechanism') state = applyStageAction(state, { type: 'retrieve-fuse', aimed: true, dt });
    else if (keyState.has('KeyQ') && state.stage === 'fan-mechanism') state.magnetProgress = Math.max(0, state.magnetProgress - dt * 0.45);
    magnet.scale.setScalar(1 + Math.sin(now * 0.004) * 0.1);
    fanGlow.intensity = state.fanOn ? 2.6 : 0;
    airflow.visible = state.fanOn;
    if (!reducedMotion && state.fanOn) airflow.position.x = Math.sin(now * 0.0012) * 0.18;
    if (++uiFrame % 6 === 0) updateUI();
    renderer.render(scene, camera);
  }
  if (!disposed) frameHandle = requestAnimationFrame(frame);
}

assembleWorkbench().then(() => { if (!disposed) { updateUI(true); frameHandle = requestAnimationFrame(frame); } }).catch((error) => { if (!disposed) { $('#error').hidden=false; $('#error').textContent=`Workbench authoring error: ${error.message}. Try reloading the game.`; } });

window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
