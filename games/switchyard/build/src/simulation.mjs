import { STATIONS, TRAIN_DIMS } from './constants.mjs';
export class TrackPath {
  constructor(id, type, params) {
    this.id = id;
    this.type = type; // 'line' or 'bezier'
    this.params = params;
    this.points = [];
    this.length = 0;
    this.sample();
  }

  sample() {
    const steps = 120;
    let prev = null;
    let dist = 0;
    const raw = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      let x, y;
      if (this.type === 'line') {
        x = this.params.x0 + (this.params.x1 - this.params.x0) * t;
        y = this.params.y0 + (this.params.y1 - this.params.y0) * t;
      } else {
        const mt = 1 - t;
        x = mt * mt * mt * this.params.x0 +
            3 * mt * mt * t * this.params.x1 +
            3 * mt * t * t * this.params.x2 +
            t * t * t * this.params.x3;
        y = mt * mt * mt * this.params.y0 +
            3 * mt * mt * t * this.params.y1 +
            3 * mt * t * t * this.params.y2 +
            t * t * t * this.params.y3;
      }

      if (prev) {
        dist += Math.hypot(x - prev.x, y - prev.y);
      }
      raw.push({ x, y, dist });
      prev = { x, y };
    }

    this.length = dist;
    // Resample at uniform 2px spacing for constant-time exact lookups
    const sampleSpacing = 2;
    const count = Math.max(2, Math.floor(this.length / sampleSpacing));
    this.points = [];

    for (let i = 0; i <= count; i++) {
      const targetDist = (i / count) * this.length;
      // Binary search along raw samples
      let low = 0, high = raw.length - 1;
      while (low < high - 1) {
        const mid = (low + high) >> 1;
        if (raw[mid].dist < targetDist) low = mid;
        else high = mid;
      }
      const p1 = raw[low], p2 = raw[high];
      const span = p2.dist - p1.dist || 0.001;
      const frac = (targetDist - p1.dist) / span;
      const x = p1.x + (p2.x - p1.x) * frac;
      const y = p1.y + (p2.y - p1.y) * frac;

      let angle = 0;
      if (i > 0) {
        const prevP = this.points[i - 1];
        angle = Math.atan2(y - prevP.y, x - prevP.x);
        if (i === 1) prevP.angle = angle;
      }
      this.points.push({ x, y, angle, dist: targetDist });
    }
  }

  getPointAt(d) {
    if (d <= 0) return this.points[0];
    if (d >= this.length) return this.points[this.points.length - 1];
    const idx = (d / this.length) * (this.points.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(this.points.length - 1, i0 + 1);
    const frac = idx - i0;
    const p0 = this.points[i0], p1 = this.points[i1];
    return {
      x: p0.x + (p1.x - p0.x) * frac,
      y: p0.y + (p1.y - p0.y) * frac,
      angle: p0.angle,
      dist: d
    };
  }
}

export class TopologyManager {
  constructor() {
    this.paths = {};
    this.initGraph();
  }

  initGraph() {
    // 1. Entrance Approaches to Stop Lines
    this.paths['N_APPROACH'] = new TrackPath('N_APPROACH', 'line', { x0: 20, y0: 190, x1: 240, y1: 190 });
    this.paths['S_APPROACH'] = new TrackPath('S_APPROACH', 'line', { x0: 20, y0: 530, x1: 240, y1: 530 });

    // 2. Entrance Curves to Merge Junction (x=430, y=360)
    this.paths['N_MERGE'] = new TrackPath('N_MERGE', 'bezier', {
      x0: 240, y0: 190, x1: 330, y1: 190, x2: 360, y2: 360, x3: 430, y3: 360
    });
    this.paths['S_MERGE'] = new TrackPath('S_MERGE', 'bezier', {
      x0: 240, y0: 530, x1: 330, y1: 530, x2: 360, y2: 360, x3: 430, y3: 360
    });

    // 3. Shared Trunk (from Merge x=430 to Switch A x=560, y=360)
    this.paths['TRUNK'] = new TrackPath('TRUNK', 'line', { x0: 430, y0: 360, x1: 560, y1: 360 });

    // 4. Divergence from Switch A: Upper to Switch B (750, 230), Lower to Switch C (750, 490)
    this.paths['A_UPPER'] = new TrackPath('A_UPPER', 'bezier', {
      x0: 560, y0: 360, x1: 650, y1: 360, x2: 660, y2: 230, x3: 750, y3: 230
    });
    this.paths['A_LOWER'] = new TrackPath('A_LOWER', 'bezier', {
      x0: 560, y0: 360, x1: 650, y1: 360, x2: 660, y2: 490, x3: 750, y3: 490
    });

    // 5. Switch B branches: Amber (1050, 130), Cyan (1050, 290)
    this.paths['B_AMBER'] = new TrackPath('B_AMBER', 'bezier', {
      x0: 750, y0: 230, x1: 840, y1: 230, x2: 880, y2: 130, x3: 1050, y3: 130
    });
    this.paths['B_CYAN'] = new TrackPath('B_CYAN', 'bezier', {
      x0: 750, y0: 230, x1: 840, y1: 230, x2: 880, y2: 290, x3: 1050, y3: 290
    });

    // 6. Switch C branches: Magenta (1050, 430), Lime (1050, 590)
    this.paths['C_MAGENTA'] = new TrackPath('C_MAGENTA', 'bezier', {
      x0: 750, y0: 490, x1: 840, y1: 490, x2: 880, y2: 430, x3: 1050, y3: 430
    });
    this.paths['C_LIME'] = new TrackPath('C_LIME', 'bezier', {
      x0: 750, y0: 490, x1: 840, y1: 490, x2: 880, y2: 590, x3: 1050, y3: 590
    });
  }

  getPath(id) {
    return this.paths[id];
  }
}

// =============================================================================
// SECTION 5: SIGNALS, SWITCHES & CLEARANCE LOCKING
// =============================================================================
export class SwitchTrack {
  constructor(id, label, x, y, branches, options) {
    this.id = id;
    this.label = label;
    this.x = x;
    this.y = y;
    this.branches = branches; // e.g. ['UPPER', 'LOWER'] or ['AMBER', 'CYAN']
    this.state = 0; // 0 or 1
    this.locked = false;
    this.lockingTrainId = null;
    this.reservations = new Map();
    this.leverAngle = 0; // Target angle based on state
    this.leverCurrentAngle = 0;
    this.lockPulse = 0; // Animation counter when rejected
    this.brightPulse = 0; // Highlight selected rail on toggle
    this.options = options || {};
  }

  toggle(audio) {
    if (this.locked) {
      this.lockPulse = 1.0;
      if (audio) audio.playSwitchLocked();
      return false;
    }
    this.state = this.state === 0 ? 1 : 0;
    this.leverAngle = this.state === 0 ? -Math.PI / 4 : Math.PI / 4;
    this.brightPulse = 1.0;
    if (audio) audio.playSwitchClick();
    return true;
  }

  update(dt) {
    // Smooth mechanical lever animation (approx 120ms)
    const target = this.state === 0 ? -Math.PI / 4 : Math.PI / 4;
    this.leverCurrentAngle += (target - this.leverCurrentAngle) * Math.min(1, dt * 18);
    if (this.lockPulse > 0) this.lockPulse = Math.max(0, this.lockPulse - dt * 4);
    if (this.brightPulse > 0) this.brightPulse = Math.max(0, this.brightPulse - dt * 3);
  }
}

export class EntranceSignal {
  constructor(id, label, entrance, stopX, stopY, mastX, mastY) {
    this.id = id;
    this.label = label;
    this.entrance = entrance; // 'N' or 'S'
    this.isGreen = true;
    this.stopX = stopX;
    this.stopY = stopY;
    this.mastX = mastX;
    this.mastY = mastY;
    this.pulse = 0;
  }

  toggle(audio) {
    this.isGreen = !this.isGreen;
    this.pulse = 1.0;
    if (audio) audio.playSignalToggle(this.isGreen);
    return this.isGreen;
  }

  update(dt) {
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 4);
  }
}

// =============================================================================
// SECTION 6: TRAIN ENTITY & ROUTE HISTORY
// =============================================================================
export class Train {
  constructor(id, entrance, destination, speed) {
    this.id = id;
    this.entrance = entrance; // 'N' or 'S'
    this.destination = destination; // STATIONS object
    this.speed = speed;
    this.stage = 'APPROACH'; // 'APPROACH', 'MERGE', 'TRUNK', 'BRANCH_1', 'BRANCH_2', 'DELIVERED', 'CRASHED'
    this.pathDist = 0;
    this.totalTraveled = 0;
    this.history = []; // Recorded locomotive positions for carriage trailing

    // Route choices committed when crossing junction commit zones
    this.committedBranchA = null; // 0 (UPPER) or 1 (LOWER)
    this.committedBranchFinal = null; // 0 or 1 for Switch B or C

    // Clearance and locking state tracking
    this.lockedSwitch = null;

    // Active Player Controls: Emergency Brake & Turbo Boost
    this.isBraking = false;
    this.brakeTimer = 0;      // Holds for up to 3.0 seconds
    this.brakeCooldown = 0;
    this.isTurbo = false;
    this.turboTimer = 0;      // Lasts for 3.0 seconds
    this.nearMissTracked = new Set(); // Prevent duplicate close-call rewards

    // Visuals & Incident removal
    this.locoPos = { x: 0, y: 0, angle: 0 };
    this.carPos = { x: 0, y: 0, angle: 0 };
    this.isDelivering = false;
    this.deliveryProgress = 0; // 0 to 1 easing into station
    this.isCrashed = false;
    this.crashTimer = 0;
    this.isRemoved = false;
    this.steamTimer = 0;
  }

  toggleBrake(audio) {
    if (this.isBraking) {
      this.isBraking = false;
      this.brakeTimer = 0;
      return false;
    }
    if (this.brakeCooldown <= 0) {
      this.isBraking = true;
      this.brakeTimer = 3.0;
      this.isTurbo = false;
      if (audio) audio.playBrakeScreech();
      return true;
    }
    return false;
  }

  engageTurbo(audio) {
    this.isTurbo = true;
    this.turboTimer = 3.2;
    this.isBraking = false;
    this.brakeTimer = 0;
    if (audio) audio.playTrainWhistle();
  }

  update(dt, sim) {
    if (this.isRemoved) return;

    if (this.isCrashed) {
      this.crashTimer += dt;
      if (this.crashTimer >= 0.75) {
        this.isRemoved = true;
      }
      return;
    }

    if (this.isDelivering) {
      this.deliveryProgress += dt * 1.5;
      if (this.deliveryProgress >= 1.0) {
        this.isRemoved = true;
      }
      return;
    }

    // Update active timers
    if (this.brakeCooldown > 0) this.brakeCooldown -= dt;
    if (this.isBraking) {
      this.brakeTimer -= dt;
      if (this.brakeTimer <= 0) {
        this.isBraking = false;
        this.brakeCooldown = 2.0;
      }
      // Brake friction sparks
      if (Math.random() < 0.35 && !sim.reducedMotion) {
        sim.spawnBrakeSpark(this.locoPos.x, this.locoPos.y);
      }
    }

    if (this.isTurbo) {
      this.turboTimer -= dt;
      if (this.turboTimer <= 0) {
        this.isTurbo = false;
      }
    }

    // Determine current path segment
    const curPath = this.getCurrentPath(sim);
    if (!curPath) return;

    // Check entrance signal hold if in APPROACH stage
    if (this.stage === 'APPROACH') {
      const signal = this.entrance === 'N' ? sim.signalN : sim.signalS;
      const stopLineDist = curPath.length - 20;

      // Safe separation behind preceding train on same entrance
      let maxAllowedDist = signal.isGreen ? Infinity : stopLineDist;
      if (!signal.isGreen) {
        maxAllowedDist = stopLineDist;
      }

      // Check distance to preceding train in same entrance queue
      const predecessor = sim.getPrecedingTrain(this);
      if (predecessor && predecessor.stage === 'APPROACH') {
        const safeTrailingDist = predecessor.pathDist - (TRAIN_DIMS.carOffset + TRAIN_DIMS.carLength + 16);
        maxAllowedDist = Math.min(maxAllowedDist, safeTrailingDist);
      }

      this.approachLimit = Math.max(this.pathDist, maxAllowedDist);
    } else {
      this.approachLimit = Infinity;
    }

    // Calculate effective forward speed (Brake = 0, Turbo = 2x)
    let curSpeed = this.speed;
    if (this.isBraking) {
      curSpeed = 0;
    } else if (this.isTurbo) {
      curSpeed = this.speed * 2.0;
    }

    // Advance locomotive along current segment
    const moveStep = Math.min(curSpeed * dt, Math.max(0, this.approachLimit - this.pathDist));
    this.pathDist += moveStep;
    this.totalTraveled += moveStep;

    // Check transition to next segment
    if (this.pathDist >= curPath.length) {
      const overflow = this.pathDist - curPath.length;
      this.advanceStage(sim, overflow);
    } else {
      // Check switch commit & locking zones
      this.checkSwitchCommit(sim);
    }

    this.updateTransforms(this.getCurrentPath(sim) || curPath);
    sim.refreshSwitchLocks();

    // Particle steam puffs
    this.steamTimer += dt;
    const steamInterval = this.isTurbo ? 0.06 : 0.16;
    if (this.steamTimer > steamInterval && !sim.reducedMotion && curSpeed > 0) {
      this.steamTimer = 0;
      sim.spawnSteam(this.locoPos.x, this.locoPos.y, this.isTurbo);
    }
  }

  getCurrentPath(sim) {
    if (this.stage === 'APPROACH') {
      return this.entrance === 'N' ? sim.topology.getPath('N_APPROACH') : sim.topology.getPath('S_APPROACH');
    }
    if (this.stage === 'MERGE') {
      return this.entrance === 'N' ? sim.topology.getPath('N_MERGE') : sim.topology.getPath('S_MERGE');
    }
    if (this.stage === 'TRUNK') {
      return sim.topology.getPath('TRUNK');
    }
    if (this.stage === 'BRANCH_1') {
      return this.committedBranchA === 0 ? sim.topology.getPath('A_UPPER') : sim.topology.getPath('A_LOWER');
    }
    if (this.stage === 'BRANCH_2') {
      if (this.committedBranchA === 0) {
        return this.committedBranchFinal === 0 ? sim.topology.getPath('B_AMBER') : sim.topology.getPath('B_CYAN');
      } else {
        return this.committedBranchFinal === 0 ? sim.topology.getPath('C_MAGENTA') : sim.topology.getPath('C_LIME');
      }
    }
    return null;
  }

  checkSwitchCommit(sim) {
    // 1. Switch A commit zone on TRUNK (approaching Switch A at end of TRUNK)
    if (this.stage === 'TRUNK') {
      const trunk = sim.topology.getPath('TRUNK');
      if (this.pathDist >= trunk.length - 48 && this.committedBranchA === null) {
        // Commit immediately to Switch A's current state
        this.committedBranchA = sim.switchA.state;
        sim.switchA.locked = true;
        sim.switchA.lockingTrainId = this.id;
        sim.switchA.reservations.set(this.id, this.totalTraveled + trunk.length - this.pathDist + TRAIN_DIMS.carOffset + TRAIN_DIMS.carLength / 2);
        this.lockedSwitch = sim.switchA;
      }
    }

    // 2. Switch B or C commit zone on BRANCH_1
    if (this.stage === 'BRANCH_1') {
      const branch1 = this.getCurrentPath(sim);
      if (this.pathDist >= branch1.length - 48 && this.committedBranchFinal === null) {
        const sw = this.committedBranchA === 0 ? sim.switchB : sim.switchC;
        this.committedBranchFinal = sw.state;
        sw.locked = true;
        sw.lockingTrainId = this.id;
        sw.reservations.set(this.id, this.totalTraveled + branch1.length - this.pathDist + TRAIN_DIMS.carOffset + TRAIN_DIMS.carLength / 2);
        this.lockedSwitch = sw;
      }
    }
  }

  advanceStage(sim, overflow) {
    if (this.stage === 'APPROACH') {
      this.stage = 'MERGE';
      this.pathDist = overflow;
    } else if (this.stage === 'MERGE') {
      this.stage = 'TRUNK';
      this.pathDist = overflow;
    } else if (this.stage === 'TRUNK') {
      if (this.committedBranchA === null) {
        this.committedBranchA = sim.switchA.state;
      }
      this.stage = 'BRANCH_1';
      this.pathDist = overflow;
    } else if (this.stage === 'BRANCH_1') {
      const sw = this.committedBranchA === 0 ? sim.switchB : sim.switchC;
      if (this.committedBranchFinal === null) {
        this.committedBranchFinal = sw.state;
      }
      this.stage = 'BRANCH_2';
      this.pathDist = overflow;
    } else if (this.stage === 'BRANCH_2') {
      // Reached station terminus!
      sim.resolveStationArrival(this);
    }
  }

  updateTransforms(curPath) {
    const pt = curPath.getPointAt(this.pathDist);
    this.locoPos = { x: pt.x, y: pt.y, angle: pt.angle };

    // Record position history for smooth trailing carriage
    if (!this.history.length || this.history[this.history.length - 1].dist !== this.totalTraveled) this.history.push({
      x: pt.x,
      y: pt.y,
      angle: pt.angle,
      dist: this.totalTraveled
    });

    // Prune old history entries
    while (this.history.length > 2 && (this.totalTraveled - this.history[0].dist) > (TRAIN_DIMS.carOffset + 40)) {
      this.history.shift();
    }

    // Calculate carriage position from exact path history
    const targetCarDist = this.totalTraveled - TRAIN_DIMS.carOffset;
    if (targetCarDist <= 0) {
      // Train still entering entrance track
      const dirX = Math.cos(pt.angle);
      const dirY = Math.sin(pt.angle);
      this.carPos = {
        x: pt.x - dirX * TRAIN_DIMS.carOffset,
        y: pt.y - dirY * TRAIN_DIMS.carOffset,
        angle: pt.angle
      };
    } else {
      // Lookup along history trail
      let found = false;
      for (let i = this.history.length - 1; i >= 1; i--) {
        const h1 = this.history[i];
        const h0 = this.history[i - 1];
        if (targetCarDist >= h0.dist && targetCarDist <= h1.dist) {
          const span = h1.dist - h0.dist || 0.001;
          const frac = (targetCarDist - h0.dist) / span;
          this.carPos = {
            x: h0.x + (h1.x - h0.x) * frac,
            y: h0.y + (h1.y - h0.y) * frac,
            angle: h0.angle
          };
          found = true;
          break;
        }
      }
      if (!found && this.history.length > 0) {
        this.carPos = { ...this.history[0] };
      }
    }
  }

  getHitSpheres() {
    return [
      { x: this.locoPos.x, y: this.locoPos.y, r: 14 },
      { x: this.carPos.x, y: this.carPos.y, r: 13 }
    ];
  }
}

// =============================================================================
// SECTION 7: GAME SIMULATION & RULES
// =============================================================================
export class GameSimulation {
  constructor(audio, storage) {
    this.audio = audio;
    this.storage = storage;
    this.topology = new TopologyManager();

    // Switches
    this.switchA = new SwitchTrack('A', 'SWITCH A', 560, 360, ['UPPER', 'LOWER']);
    this.switchB = new SwitchTrack('B', 'SWITCH B', 750, 230, ['AMBER', 'CYAN']);
    this.switchC = new SwitchTrack('C', 'SWITCH C', 750, 490, ['MAGENTA', 'LIME']);

    // Entrance Signals
    this.signalN = new EntranceSignal('SIG_N', 'NORTH SIGNAL', 'N', 240, 190, 240, 140);
    this.signalS = new EntranceSignal('SIG_S', 'SOUTH SIGNAL', 'S', 240, 530, 240, 580);

    // Gameplay state
    this.state = 'TITLE'; // 'TITLE', 'PLAYING', 'PAUSED', 'WAVE_CLEAR', 'VICTORY', 'GAME_OVER', 'TUTORIAL'
    this.isEndless = false;
    this.currentWave = 1;
    this.score = 0;
    this.streak = 0;
    this.lives = 3;
    this.waveTimer = 0;
    this.waveTotalTrains = 6;
    this.waveDeliveredCount = 0;
    this.waveResolvedCount = 0;

    // Collections
    this.trains = [];
    this.spawnSchedule = [];
    this.particles = [];
    this.floatingScores = [];
    this.nearConflictActive = false;
    this.tutorialResetTimer = 0;
    this.reducedMotion = this.storage.memoryData.settings.reducedMotion;

    // Interactive targeting & selection
    this.inspectedTrain = null;

    // Tutorial state
    this.tutorialStep = 1; // 1 to 4
    this.tutorialTrain = null;
    this.tutorialHoldingSatisfied = false;
  }

  startStandardRun() {
    this.isEndless = false;
    this.currentWave = 1;
    this.score = 0;
    this.streak = 0;
    this.lives = 3;
    this.setupWave(1);
    this.state = 'PLAYING';
  }

  startEndlessRun() {
    this.isEndless = true;
    this.currentWave = 11;
    this.score = 0;
    this.streak = 0;
    this.lives = 3;
    this.setupWave(11);
    this.state = 'PLAYING';
  }

  restartWave() {
    const checkpoint = this.waveCheckpoint;
    if (checkpoint) Object.assign(this, checkpoint);
    this.setupWave(this.currentWave);
    this.state = 'PLAYING';
  }

  setupWave(waveNum) {
    this.waveCheckpoint = { score: this.score, streak: this.streak, lives: this.lives };
    this.currentWave = waveNum;
    this.waveTimer = 0;
    this.waveDeliveredCount = 0;
    this.waveResolvedCount = 0;
    this.trains = [];
    this.particles = [];
    this.floatingScores = [];
    this.spawnSchedule = [];

    this.inspectedTrain = null;
    this.tutorialResetTimer = 0;
    // Reset switches & signals cleanly
    this.signalN.isGreen = true;
    this.signalS.isGreen = true;
    this.switchA.state = 0;
    this.switchA.locked = false;
    this.switchB.state = 0;
    this.switchB.locked = false;
    this.switchC.state = 0;
    this.switchC.locked = false;
    for (const sw of [this.switchA, this.switchB, this.switchC]) { sw.lockingTrainId = null; sw.reservations = new Map(); }

    // Difficulty curve based on wave
    let trainCount = 6;
    let availableDestinations = [STATIONS.AMBER, STATIONS.CYAN];
    let baseSpeed = 95;
    let spawnInterval = 4.4;

    if (waveNum >= 3) availableDestinations.push(STATIONS.MAGENTA);
    if (waveNum >= 5) availableDestinations.push(STATIONS.LIME);

    if (waveNum <= 2) {
      trainCount = 6;
      baseSpeed = 95 + (waveNum - 1) * 5;
      spawnInterval = 4.4;
    } else if (waveNum <= 4) {
      trainCount = 8;
      baseSpeed = 105 + (waveNum - 3) * 5;
      spawnInterval = 4.0;
    } else if (waveNum <= 6) {
      trainCount = 10;
      baseSpeed = 115 + (waveNum - 5) * 5;
      spawnInterval = 3.6;
    } else if (waveNum <= 8) {
      trainCount = 12;
      baseSpeed = 125 + (waveNum - 7) * 4;
      spawnInterval = 3.3;
    } else if (waveNum <= 10) {
      trainCount = 14;
      baseSpeed = 132 + (waveNum - 9) * 4;
      spawnInterval = 3.0;
    } else {
      // Endless: carefully bounded
      trainCount = 12 + Math.min(8, Math.floor((waveNum - 10) * 0.8));
      baseSpeed = Math.min(145, 132 + (waveNum - 10) * 2);
      spawnInterval = Math.max(2.8, 3.2 - (waveNum - 10) * 0.05);
    }

    this.waveTotalTrains = trainCount;

    // Seeded deterministic schedule generation
    let entranceToggle = waveNum % 2 === 0 ? 'N' : 'S';
    let scheduleTime = 1.0;

    for (let i = 0; i < trainCount; i++) {
      // Alternating or patterned entrances to create timing interest
      if (waveNum >= 7 && (i % 3 === 0)) {
        // Occasional tight pairing that rewards signal dispatching
        scheduleTime += 0.8;
      } else {
        scheduleTime += spawnInterval + (Math.sin(i * 1.5 + waveNum) * 0.4);
      }
      entranceToggle = entranceToggle === 'N' ? 'S' : 'N';

      const destIdx = (i * 3 + waveNum) % availableDestinations.length;
      const destination = availableDestinations[destIdx];

      this.spawnSchedule.push({
        id: `T_${waveNum}_${i}`,
        entrance: entranceToggle,
        destination: destination,
        time: scheduleTime,
        speed: baseSpeed,
        spawned: false
      });
    }
  }

  startTutorial() {
    this.state = 'TUTORIAL';
    this.tutorialStep = 1;
    this.score = 0;
    this.streak = 0;
    this.lives = 3;
    this.trains = [];
    this.spawnSchedule = [];
    this.particles = [];
    this.floatingScores = [];
    this.setupTutorialStep(1);
  }

  setupTutorialStep(step) {
    this.tutorialStep = step;
    this.tutorialResetTimer = 0;
    for (const sw of [this.switchA, this.switchB, this.switchC]) { sw.reservations.clear(); sw.locked = false; sw.lockingTrainId = null; }
    this.trains = [];
    this.spawnSchedule = [];
    this.signalN.isGreen = true;
    this.signalS.isGreen = true;
    this.tutorialHoldingSatisfied = false;

    if (step === 1) {
      // Step 1: Switch B to Amber
      this.switchA.state = 0; // Upper
      this.switchB.state = 1; // Currently Cyan!
      const t = new Train('TUT_1', 'N', STATIONS.AMBER, 80);
      this.trains.push(t);
    } else if (step === 2) {
      // Step 2: Switch A to Lower and Switch C to Lime
      this.switchA.state = 0; // Currently Upper
      this.switchC.state = 0; // Currently Magenta
      const t = new Train('TUT_2', 'N', STATIONS.LIME, 85);
      this.trains.push(t);
    } else if (step === 3 || step === 4) {
      // Steps 3 & 4: Signals & Merge holding
      this.switchA.state = 0;
      this.switchB.state = 0;
      this.signalS.isGreen = true; // Player must actively hold South
      const t1 = new Train('TUT_3_N', 'N', STATIONS.AMBER, 85);
      const t2 = new Train('TUT_3_S', 'S', STATIONS.AMBER, 85);
      // North is slightly closer to cross merge first
      t1.pathDist = 30;
      t2.pathDist = 0;
      this.trains.push(t1, t2);
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING' && this.state !== 'TUTORIAL') return;

    if (this.tutorialResetTimer > 0) {
      this.tutorialResetTimer -= dt;
      if (this.tutorialResetTimer <= 0 && this.state === 'TUTORIAL') this.setupTutorialStep(this.tutorialStep);
    }
    // Update switches & signals
    this.switchA.update(dt);
    this.switchB.update(dt);
    this.switchC.update(dt);
    this.signalN.update(dt);
    this.signalS.update(dt);

    this.waveTimer += dt;

    // Spawning logic for regular play
    if (this.state === 'PLAYING') {
      this.checkSpawns();
    }

    // Update active trains
    for (let i = 0; i < this.trains.length; i++) {
      this.trains[i].update(dt, this);
    }

    // Check near-conflict & collision
    this.checkConflictsAndCollisions();

    // Clean up finished trains
    this.trains = this.trains.filter(t => !t.isRemoved);
    this.refreshSwitchLocks();

    // Update visual particles and floating texts
    this.updateEffects(dt);

    // Tutorial step evaluation
    if (this.state === 'TUTORIAL') {
      this.updateTutorialFlow();
      return;
    }

    // Check wave completion
    if (this.state === 'PLAYING' && this.waveResolvedCount >= this.waveTotalTrains && this.trains.length === 0) {
      this.completeWave();
    }
  }

  refreshSwitchLocks() {
    for (const sw of [this.switchA, this.switchB, this.switchC]) {
      for (const [id, clearAt] of sw.reservations) {
        const train = this.trains.find(t => t.id === id && !t.isRemoved);
        if (!train || (!train.isCrashed && train.totalTraveled >= clearAt)) sw.reservations.delete(id);
      }
      sw.locked = sw.reservations.size > 0;
      sw.lockingTrainId = sw.reservations.keys().next().value ?? null;
    }
  }

  checkSpawns() {
    for (const item of this.spawnSchedule) {
      if (!item.spawned && this.waveTimer >= item.time) {
        // Ensure entrance queue has capacity before spawning
        const queueCount = this.trains.filter(t => t.entrance === item.entrance && t.stage === 'APPROACH').length;
        if (queueCount >= 2) {
          // Delay spawn time slightly until track clears
          item.time += 0.5;
          continue;
        }

        const t = new Train(item.id, item.entrance, item.destination, item.speed);
        this.trains.push(t);
        item.spawned = true;
      }
    }
  }

  getPrecedingTrain(train) {
    let best = null;
    let minDist = Infinity;
    for (const other of this.trains) {
      if (other.id !== train.id && !other.isRemoved && !other.isCrashed && other.entrance === train.entrance) {
        const d = other.stage === 'APPROACH' && train.stage === 'APPROACH' ? other.pathDist - train.pathDist : other.totalTraveled - train.totalTraveled;
        if (d > 0 && d < minDist) {
          minDist = d;
          best = other;
        }
      }
    }
    return best;
  }

  checkConflictsAndCollisions() {
    this.nearConflictActive = false;

    // Merge conflict detection (North vs South curve approaching shared trunk)
    const nTrains = this.trains.filter(t => t.entrance === 'N' && (t.stage === 'MERGE' || (t.stage === 'APPROACH' && this.signalN.isGreen)));
    const sTrains = this.trains.filter(t => t.entrance === 'S' && (t.stage === 'MERGE' || (t.stage === 'APPROACH' && this.signalS.isGreen)));

    for (const tn of nTrains) {
      for (const ts of sTrains) {
        // Distance to merge point (430, 360)
        const distN = Math.hypot(tn.locoPos.x - 430, tn.locoPos.y - 360);
        const distS = Math.hypot(ts.locoPos.x - 430, ts.locoPos.y - 360);
        if (distN < 180 && distS < 180 && Math.abs(distN - distS) < 55) {
          this.nearConflictActive = true;
          this.audio.playNearConflictAlert();


        }
      }
    }

    // A close call is awarded only after one rear carriage has cleared the merge,
    // while the other locomotive approaches it. Crashes can never earn it.
    for (const lead of this.trains) for (const follow of this.trains) {
      if (lead === follow || lead.entrance === follow.entrance || lead.isCrashed || follow.isCrashed || lead.isRemoved || follow.isRemoved) continue;
      if (lead.stage === 'TRUNK' && lead.carPos.x > 458 && follow.stage === 'MERGE' && follow.locoPos.x > 390 && !lead.nearMissTracked.has(follow.id)) {
        lead.nearMissTracked.add(follow.id); follow.nearMissTracked.add(lead.id);
        this.score += 250; this.audio.playNearMissBonus();
        this.spawnFloatingText('CLOSE CALL! +250', 430, 320, '#38bdf8');
      }
    }
    // Physical collision checks between all active trains
    const len = this.trains.length;
    for (let i = 0; i < len; i++) {
      const t1 = this.trains[i];
      if (t1.isCrashed || t1.isDelivering || t1.isRemoved) continue;

      for (let j = i + 1; j < len; j++) {
        const t2 = this.trains[j];
        if (t2.isCrashed || t2.isDelivering || t2.isRemoved) continue;

        // Collision is only possible on shared tracks (MERGE, TRUNK, or same branch)
        const canCollide = (t1.stage === 'TRUNK' || t2.stage === 'TRUNK') ||
                           (t1.stage === 'MERGE' && t2.stage === 'MERGE') ||
                           (t1.stage === t2.stage && t1.committedBranchA === t2.committedBranchA && t1.committedBranchFinal === t2.committedBranchFinal);

        if (!canCollide) continue;

        // Bounded sphere distance check
        const spheres1 = t1.getHitSpheres();
        const spheres2 = t2.getHitSpheres();
        let hit = false;

        for (const s1 of spheres1) {
          for (const s2 of spheres2) {
            if (Math.hypot(s1.x - s2.x, s1.y - s2.y) < (s1.r + s2.r)) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }

        if (hit) {
          this.triggerCollision(t1, t2);
          return;
        }
      }
    }
  }

  triggerCollision(t1, t2) {
    if (!['PLAYING', 'TUTORIAL'].includes(this.state) || t1.isCrashed || t2.isCrashed || t1.isRemoved || t2.isRemoved) return;
    t1.isCrashed = true;
    t2.isCrashed = true;
    this.audio.playCollisionCrash();

    const midX = (t1.locoPos.x + t2.locoPos.x) / 2;
    const midY = (t1.locoPos.y + t2.locoPos.y) / 2;

    this.spawnIncidentSparks(midX, midY);
    this.spawnFloatingText('-1 LIFE', midX, midY - 20, '#ef4444');

    this.streak = 0;
    this.waveResolvedCount += 2;

    if (this.state === 'PLAYING') {
      this.deductLife('Train Collision in Junction');
    } else if (this.state === 'TUTORIAL') {
      // Friendly reset for practice step
      this.tutorialResetTimer = 0.8;
    }
  }

  resolveStationArrival(train) {
    if (!['PLAYING', 'TUTORIAL'].includes(this.state) || train.isDelivering || train.isCrashed || train.isRemoved) return;
    const reachedStationId = this.committedBranchFinalToStation(train.committedBranchA, train.committedBranchFinal);
    const correct = reachedStationId === train.destination.id;

    if (correct) {
      // Award base + streak bonus + fever multiplier + turbo speedrun bonus
      const isFever = this.streak >= 5;
      const streakBonus = Math.min(100, this.streak * 10);
      let points = 100 + streakBonus;
      if (train.isTurbo) points += 50; // Speedrun reward
      if (isFever) points *= 2; // Rush Hour Fever 2x multiplier

      this.score += points;
      this.streak++;
      this.waveDeliveredCount++;
      this.waveResolvedCount++;

      this.audio.playArrivalChime(this.streak);
      this.spawnStationCelebration(train.destination);
      const textLabel = train.isTurbo ? `⚡ +${points} TURBO!` : (isFever ? `🔥 +${points} FEVER!` : `+${points}`);
      this.spawnFloatingText(textLabel, train.destination.x - 50, train.destination.y, '#facc15');

      train.isDelivering = true;
      if (this.state === 'TUTORIAL') {
        if (this.tutorialStep < 3) {
          this.setupTutorialStep(this.tutorialStep + 1);
          this.ui?.updateTutorialBanner(this.tutorialStep);
        } else if (train.entrance === 'S') {
          this.storage.memoryData.tutorialCompleted = true;
          this.storage.save();
          this.state = 'TITLE';
          this.ui?.hideAllPanels();
          if (this.ui) this.ui.showPanel(this.ui.panelTitle);
        }
      }
      if (this.state === 'PLAYING') {
        this.storage.updateRecord(this.score, this.currentWave);
      }
    } else {
      // Wrong station arrival
      this.streak = 0;
      this.waveResolvedCount++;
      this.audio.playWrongStation();
      this.spawnIncidentSparks(train.locoPos.x, train.locoPos.y);

      const targetSt = train.destination;
      this.spawnFloatingText(`WRONG: Expected ${targetSt.symbol}`, train.locoPos.x - 60, train.locoPos.y - 15, '#f43f5e');

      train.isDelivering = true;
      if (this.state === 'PLAYING') {
        this.deductLife(`Misrouted to wrong station (Expected ${targetSt.label} ${targetSt.symbol})`);
      } else if (this.state === 'TUTORIAL') {
        this.tutorialResetTimer = 0.8;
      }
    }
  }

  committedBranchFinalToStation(branchA, branchFinal) {
    if (branchA === 0) {
      return branchFinal === 0 ? 'AMBER' : 'CYAN';
    } else {
      return branchFinal === 0 ? 'MAGENTA' : 'LIME';
    }
  }

  deductLife(reason) {
    this.lives = Math.max(0, this.lives - 1);
    if (this.lives <= 0) {
      this.state = 'GAME_OVER';
      this.storage.updateRecord(this.score, this.currentWave);
      if (this.ui) {
        this.ui.showGameOver(reason);
      }
    }
  }

  completeWave() {
    if (this.state !== 'PLAYING') return;
    this.audio.playWaveFanfare();
    // Calculated efficiency bonus based on schedule prompt
    const baseWaveTime = this.waveTotalTrains * 4.2 + 10;
    const timeSaved = Math.max(0, baseWaveTime - this.waveTimer);
    const efficiencyBonus = Math.max(50, Math.floor(timeSaved * 8));

    this.score += efficiencyBonus;
    this.storage.updateRecord(this.score, this.currentWave);

    if (!this.isEndless && this.currentWave >= 10) {
      // Victory!
      this.state = 'VICTORY';
      this.storage.memoryData.endlessUnlocked = true;
      this.storage.save();
      if (this.ui) this.ui.showVictory();
    } else {
      this.state = 'WAVE_CLEAR';
      if (this.ui) this.ui.showWaveClear(efficiencyBonus);
    }
  }

  updateTutorialFlow() {
    const t = this.trains[0];
    if (this.tutorialStep === 1) {
      // Check if Switch B is set to Amber
      if (this.switchB.state === 0 && t && t.stage === 'BRANCH_2') {
        // Progress after delivery
      }
    } else if (this.tutorialStep === 3) {
      // Check that North cleared while South was safely held
      const northTrain = this.trains.find(tr => tr.entrance === 'N');
      const southTrain = this.trains.find(tr => tr.entrance === 'S');

      if (!this.tutorialHoldingSatisfied && northTrain && northTrain.stage === 'TRUNK') {
        this.tutorialHoldingSatisfied = true;
        this.tutorialStep = 4;
        if (this.ui) this.ui.updateTutorialBanner(4);
      }
    }
  }

  updateEffects(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt / p.maxLife;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const f of this.floatingScores) {
      f.y -= 25 * dt;
      f.life -= dt / f.maxLife;
    }
    this.floatingScores = this.floatingScores.filter(f => f.life > 0);
  }

  spawnSteam(x, y, isTurbo = false) {
    if (this.particles.length > 95) return;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 10 - (isTurbo ? 25 : 15),
      vy: -15 - Math.random() * 15,
      r: isTurbo ? 4 + Math.random() * 4 : 3 + Math.random() * 3,
      color: isTurbo ? 'rgba(253, 224, 71, 0.65)' : 'rgba(240, 244, 248, 0.4)',
      life: 1.0,
      maxLife: isTurbo ? 0.45 : 0.6
    });
  }

  spawnBrakeSpark(x, y) {
    if (this.particles.length > 95) return;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 40,
      vy: -10 - Math.random() * 20,
      r: 2 + Math.random() * 2,
      color: '#f97316',
      life: 1.0,
      maxLife: 0.35
    });
  }

  spawnIncidentSparks(x, y) {
    const count = this.reducedMotion ? 4 : 20;
    for (let i = 0; i < count && this.particles.length < 100; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 40 + Math.random() * 70;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 2,
        color: i % 2 === 0 ? '#ef4444' : '#f59e0b',
        life: 1.0,
        maxLife: 0.5
      });
    }
  }

  spawnStationCelebration(st) {
    const count = this.reducedMotion ? 6 : 24;
    for (let i = 0; i < count && this.particles.length < 100; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.particles.push({
        x: st.x - 20,
        y: st.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 3,
        color: st.color,
        life: 1.0,
        maxLife: 0.7
      });
    }
  }

  spawnFloatingText(text, x, y, color) {
    if (this.floatingScores.length >= 32) this.floatingScores.shift();
    this.floatingScores.push({
      text: text,
      x: x,
      y: y,
      color: color,
      life: 1.0,
      maxLife: 0.85
    });
  }
}

// =============================================================================
// SECTION 8: PROCEDURAL 2D RENDERING ENGINE
// =============================================================================
