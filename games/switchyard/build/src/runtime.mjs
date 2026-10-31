import { createEngine, defineRuntimeKit, defineEvent, defineResource, defineComponent } from '../vendor/nexusengine.mjs';
import { SIM_DT } from './constants.mjs';

export const DispatchAction = defineEvent('switchyard.dispatch');
export const YardState = defineResource('switchyard.state');
export const TrainView = defineComponent('switchyard.train');
export const ENGINE_PIN = '4906076837d4020ff2e22fe98723e0922ea6af62';

// Authored rules stay in Switchyard. Nexus owns phase ordering, the single fixed
// clock, semantic input delivery, entity membership and committed observations.
export function createYardRuntime(sim) {
  const engine = createEngine({ tick: { maxDelta: SIM_DT } });
  engine.scheduler.addPhase('observe');
  const actions = new Map();
  const entities = new Map();
  let applying = false, disposed = false, accumulator = 0;
  const kit = defineRuntimeKit({
    id: 'switchyard-game-kit',
    events: { DispatchAction }, resources: { YardState }, components: { TrainView },
    systems: [
      { phase: 'input', name: 'yard-dispatch', system(world) {
        const commands = world.readEvents(DispatchAction);
        world.clearEvents(DispatchAction);
        applying = true;
        try { for (const { name, args } of commands) actions.get(name)?.(...args); }
        finally { applying = false; }
      } },
      { phase: 'simulate', name: 'yard-rules', system(_world, context) { sim.update(context.delta); } },
      { phase: 'observe', name: 'yard-observations', system(world) {
        const active = new Set(sim.trains.filter(t => !t.isRemoved).map(t => t.id));
        for (const [id, entity] of entities) if (!active.has(id)) { world.removeEntity(entity); entities.delete(id); }
        for (const train of sim.trains) {
          if (train.isRemoved) continue;
          if (!entities.has(train.id)) entities.set(train.id, world.addEntity());
          world.setComponent(entities.get(train.id), TrainView, {
            id: train.id, entrance: train.entrance, destination: train.destination.id,
            stage: train.stage, x: train.locoPos.x, y: train.locoPos.y,
            routeA: train.committedBranchA, routeFinal: train.committedBranchFinal,
            crashed: train.isCrashed, delivering: train.isDelivering
          });
        }
        world.setResource(YardState, { state: sim.state, wave: sim.currentWave,
          score: sim.score, lives: sim.lives, streak: sim.streak,
          activeTime: sim.waveTimer, activeTrains: active.size });
      } }
    ]
  });
  engine.installKit(kit);
  return {
    engine, kit,
    bindAction(name, handler) {
      if (actions.has(name)) throw new Error(`Duplicate action: ${name}`);
      actions.set(name, handler);
    },
    send(name, args = []) {
      if (disposed || !actions.has(name)) return false;
      // Nested semantic commands from a click share this tick, never a later one.
      if (applying) { actions.get(name)(...args); return true; }
      if (engine.world.readEvents(DispatchAction).length >= 64) return false;
      engine.world.emit(DispatchAction, { name, args: structuredClone(args) });
      return true;
    },
    step() { if (!disposed) engine.tick(SIM_DT); },
    advance(seconds) {
      if (disposed) return 0;
      accumulator = Math.min(accumulator + Math.max(0, Number.isFinite(seconds) ? seconds : 0), SIM_DT * 5);
      let steps = 0;
      while (accumulator + 1e-10 >= SIM_DT && steps < 5) {
        engine.tick(SIM_DT); accumulator -= SIM_DT; steps++;
      }
      return steps;
    },
    resetInput() { engine.world.clearEvents(DispatchAction); },
    resetFrameTime() { accumulator = 0; engine.world.clearEvents(DispatchAction); },
    dispose() {
      if (disposed) return;
      disposed = true; actions.clear();
      for (const entity of entities.values()) engine.world.removeEntity(entity);
      entities.clear(); engine.world.clearAllEvents(); engine.world.clearJournal();
    },
    get disposed() { return disposed; }
  };
}
