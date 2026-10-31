import { AudioSystem } from './audio.mjs';
import { StorageManager } from './storage.mjs';
import { GameSimulation } from './simulation.mjs';
import { Renderer2D } from './renderer.mjs';
import { UIManager } from './ui.mjs';
import { createYardRuntime, ENGINE_PIN } from './runtime.mjs';

export function mountSwitchyard() {
  window.switchyard?.dispose();
  const lifetime = new AbortController();
  const storage = new StorageManager();
  const audio = new AudioSystem();
  audio.muted = storage.memoryData.settings.muted;
  audio.volume = storage.memoryData.settings.volume / 100;
  const sim = new GameSimulation(audio, storage);
  const renderer = new Renderer2D(document.getElementById('game-canvas'), sim);
  const runtime = createYardRuntime(sim);
  const ui = new UIManager(sim, renderer, audio, storage, runtime);
  sim.ui = ui;
  window.gameUI = ui;
  renderer.resize();
  let last = performance.now(), frame = 0, disposed = false;
  function loop(now) {
    if (disposed) return;
    if (document.hidden) { last = now; runtime.resetFrameTime(); }
    else {
      runtime.advance((now - last) / 1000); last = now;
      renderer.render();
      if (['PLAYING', 'TUTORIAL'].includes(sim.state)) ui.updateHUD();
    }
    frame = requestAnimationFrame(loop);
  }
  window.addEventListener('resize', () => renderer.resize(), { signal: lifetime.signal });
  document.addEventListener('visibilitychange', () => { last = performance.now(); runtime.resetFrameTime(); }, { signal: lifetime.signal });
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); lifetime.abort(); ui.dispose();
    runtime.dispose(); sim.ui = null;
    if (audio.ctx && audio.ctx.state !== 'closed') audio.ctx.close().catch(() => {});
    if (window.gameUI === ui) delete window.gameUI;
  }
  window.addEventListener('pagehide', dispose, { signal: lifetime.signal });
  const app = { sim, renderer, runtime, ui, storage, enginePin: ENGINE_PIN, dispose };
  window.switchyard = app;
  frame = requestAnimationFrame(loop);
  return app;
}
mountSwitchyard();
// Back-forward cache restores the document after pagehide disposed its host.
window.addEventListener('pageshow', event => { if (event.persisted) mountSwitchyard(); });
