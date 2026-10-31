import { STATIONS } from './constants.mjs';
import { runChecks } from './checks.mjs';
export class UIManager {
  constructor(sim, renderer, audio, storage, controller) {
    this.controller = controller;
    this.abort = new AbortController();
    this.resumeState = 'PLAYING';
    this.sim = sim;
    this.renderer = renderer;
    this.audio = audio;
    this.storage = storage;

    // DOM Elements Cache
    this.valScore = document.getElementById('val-score');
    this.valStreak = document.getElementById('val-streak');
    this.valWave = document.getElementById('val-wave');
    this.labelWave = document.getElementById('label-wave');
    this.livesContainer = document.getElementById('lives-container');
    this.previewList = document.getElementById('preview-list');

    // Bottom Controls
    this.btnSigN = document.getElementById('btn-sig-n');
    this.btnSigS = document.getElementById('btn-sig-s');
    this.btnSwA = document.getElementById('btn-sw-a');
    this.btnSwB = document.getElementById('btn-sw-b');
    this.btnSwC = document.getElementById('btn-sw-c');
    this.txtSigN = document.getElementById('txt-sig-n');
    this.txtSigS = document.getElementById('txt-sig-s');
    this.txtSwA = document.getElementById('txt-sw-a');
    this.txtSwB = document.getElementById('txt-sw-b');
    this.txtSwC = document.getElementById('txt-sw-c');
    this.btnBrake = document.getElementById('btn-emergency-brake');
    this.btnTurbo = document.getElementById('btn-turbo-whistle');
    this.hudFever = document.getElementById('hud-fever');

    // Panels
    this.panelTitle = document.getElementById('panel-title');
    this.panelPause = document.getElementById('panel-pause');
    this.panelWaveClear = document.getElementById('panel-wave-clear');
    this.panelVictory = document.getElementById('panel-victory');
    this.panelGameOver = document.getElementById('panel-game-over');
    this.panelSettings = document.getElementById('panel-settings');
    this.panelTests = document.getElementById('panel-tests');

    // Tutorial Banner
    this.tutBanner = document.getElementById('tutorial-banner');
    this.tutStepTitle = document.getElementById('tut-step-title');
    this.tutText = document.getElementById('tut-text');

    const inputMethods = ['handleWorldClick', 'toggleSwitchA', 'toggleSwitchB', 'toggleSwitchC', 'toggleSignalN', 'toggleSignalS', 'triggerBrakeAction', 'triggerTurboAction'];
    for (const name of inputMethods) {
      const apply = this[name].bind(this);
      controller.bindAction(name, (...args) => {
        if (['PLAYING', 'TUTORIAL'].includes(sim.state)) apply(...args);
      });
      this[name] = (...args) => controller.send(name, args);
    }
    this.bindEvents();
    this.updateTitleRecords();
  }

  listen(target, type, handler) { target.addEventListener(type, handler, { signal: this.abort.signal }); }

  dispose() { this.abort.abort(); }

  bindEvents() {
    // Canvas Click / Tap dispatching
    this.listen(this.renderer.canvas, 'pointerdown', (e) => {
      this.audio.ensureContext();
      const pos = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.handleWorldClick(pos.x, pos.y);
    });

    // Pointer move for train inspection and path preview
    this.listen(this.renderer.canvas, 'pointermove', (e) => {
      const pos = this.renderer.screenToWorld(e.clientX, e.clientY);
      let found = null;
      for (const t of this.sim.trains) {
        if (!t.isRemoved && Math.hypot(pos.x - t.locoPos.x, pos.y - t.locoPos.y) < 32) {
          found = t;
          break;
        }
      }
      this.sim.inspectedTrain = found;
    });

    // Keyboard Shortcuts
    this.listen(window, 'keydown', (e) => {
      if (e.repeat || e.target?.matches?.('input, textarea, select, [contenteditable=true]')) return;
      if ([' ', 'Escape'].includes(e.key)) {
        if (e.key === ' ' && e.target?.closest?.('button')) return;
        e.preventDefault();
      }
      this.audio.ensureContext();


      const key = e.key.toUpperCase();
      if (key === 'A') {
        this.toggleSwitchA();
      } else if (key === 'B') {
        this.toggleSwitchB();
      } else if (key === 'C') {
        this.toggleSwitchC();
      } else if (key === '1') {
        this.toggleSignalN();
      } else if (key === '2') {
        this.toggleSignalS();
      } else if (key === 'E') {
        this.triggerBrakeAction();
      } else if (key === 'W') {
        this.triggerTurboAction();
      } else if (key === ' ' || key === 'ESCAPE') {
        this.togglePause();
      } else if (key === 'M') {
        this.toggleMute();
      }
    });

    // Page Visibility Auto-Pause
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden && ['PLAYING', 'TUTORIAL'].includes(this.sim.state)) {
        this.pauseGame();
      }
    });

    this.listen(window, 'blur', () => {
      if (['PLAYING', 'TUTORIAL'].includes(this.sim.state)) this.pauseGame();
      this.controller.resetInput();
    });

    // Bottom Bar Buttons
    this.listen(this.btnSigN, 'click', () => { this.audio.ensureContext(); this.toggleSignalN(); });
    this.listen(this.btnSigS, 'click', () => { this.audio.ensureContext(); this.toggleSignalS(); });
    this.listen(this.btnSwA, 'click', () => { this.audio.ensureContext(); this.toggleSwitchA(); });
    this.listen(this.btnSwB, 'click', () => { this.audio.ensureContext(); this.toggleSwitchB(); });
    this.listen(this.btnSwC, 'click', () => { this.audio.ensureContext(); this.toggleSwitchC(); });
    this.listen(this.btnBrake, 'click', () => { this.audio.ensureContext(); this.triggerBrakeAction(); });
    this.listen(this.btnTurbo, 'click', () => { this.audio.ensureContext(); this.triggerTurboAction(); });

    // HUD Top Buttons
    this.listen(document.getElementById('btn-pause'), 'click', () => { this.audio.ensureContext(); this.togglePause(); });
    this.listen(document.getElementById('btn-mute'), 'click', () => { this.audio.ensureContext(); this.toggleMute(); });

    // Title Screen Actions
    this.listen(document.getElementById('btn-play-standard'), 'click', () => {
      this.audio.ensureContext();
      this.hideAllPanels();
      this.controller.resetInput(); this.sim.startStandardRun();
    });

    this.listen(document.getElementById('btn-start-tutorial'), 'click', () => {
      this.audio.ensureContext();
      this.hideAllPanels();
      this.controller.resetInput(); this.sim.startTutorial();
      this.updateTutorialBanner(1);
    });

    this.listen(document.getElementById('btn-play-endless'), 'click', () => {
      this.audio.ensureContext();
      this.hideAllPanels();
      this.controller.resetInput(); this.sim.startEndlessRun();
    });

    this.listen(document.getElementById('btn-open-settings'), 'click', () => {
      this.showPanel(this.panelSettings);
    });

    this.listen(document.getElementById('btn-open-tests'), 'click', () => {
      this.showPanel(this.panelTests);
    });

    this.listen(document.getElementById('btn-skip-tut'), 'click', () => {
      this.tutBanner.classList.remove('visible');
      this.showPanel(this.panelTitle);
      this.sim.state = 'TITLE';
    });

    // Pause Screen Actions
    this.listen(document.getElementById('btn-resume'), 'click', () => {
      this.hideAllPanels();
      this.sim.state = this.resumeState;
      if (this.sim.state === 'TUTORIAL') this.updateTutorialBanner(this.sim.tutorialStep);
    });
    this.listen(document.getElementById('btn-pause-settings'), 'click', () => {
      this.showPanel(this.panelSettings);
    });
    this.listen(document.getElementById('btn-restart-current'), 'click', () => {
      this.hideAllPanels();
      if (this.resumeState === 'TUTORIAL') { this.controller.resetInput(); this.sim.startTutorial(); this.updateTutorialBanner(1); }
      else { this.controller.resetInput(); this.sim.restartWave(); }
    });
    this.listen(document.getElementById('btn-quit-title'), 'click', () => {
      this.hideAllPanels();
      this.showPanel(this.panelTitle);
      this.sim.state = 'TITLE';
      this.updateTitleRecords();
    });

    // Wave Clear & Victory Actions
    this.listen(document.getElementById('btn-next-wave'), 'click', () => {
      this.hideAllPanels();
      this.controller.resetInput(); this.sim.setupWave(this.sim.currentWave + 1);
      this.sim.state = 'PLAYING';
    });

    this.listen(document.getElementById('btn-vic-endless'), 'click', () => {
      this.hideAllPanels();
      this.controller.resetInput(); this.sim.startEndlessRun();
    });
    this.listen(document.getElementById('btn-vic-title'), 'click', () => {
      this.hideAllPanels();
      this.showPanel(this.panelTitle);
      this.sim.state = 'TITLE';
      this.updateTitleRecords();
    });

    // Game Over Actions
    this.listen(document.getElementById('btn-retry-run'), 'click', () => {
      this.hideAllPanels();
      this.controller.resetInput(); this.sim.startStandardRun();
    });
    this.listen(document.getElementById('btn-go-title'), 'click', () => {
      this.hideAllPanels();
      this.showPanel(this.panelTitle);
      this.sim.state = 'TITLE';
      this.updateTitleRecords();
    });

    // Settings Modal
    this.listen(document.getElementById('btn-close-settings'), 'click', () => {
      this.hidePanel(this.panelSettings);
      if (this.sim.state === 'PAUSED') this.showPanel(this.panelPause);
      else if (this.sim.state === 'TITLE') this.showPanel(this.panelTitle);
    });

    const muteToggle = document.getElementById('toggle-mute-switch');
    this.listen(muteToggle, 'click', () => {
      this.toggleMute();
      muteToggle.classList.toggle('active', this.audio.muted);
    });

    const volSlider = document.getElementById('slider-volume');
    volSlider.value = this.audio.volume * 100;
    this.listen(volSlider, 'input', (e) => {
      this.audio.volume = e.target.value / 100;
      this.storage.memoryData.settings.volume = e.target.value;
      this.storage.save();
    });

    const motionToggle = document.getElementById('toggle-reduced-motion');
    motionToggle.classList.toggle('active', this.sim.reducedMotion);
    this.listen(motionToggle, 'click', () => {
      this.sim.reducedMotion = !this.sim.reducedMotion;
      motionToggle.classList.toggle('active', this.sim.reducedMotion);
      this.storage.memoryData.settings.reducedMotion = this.sim.reducedMotion;
      this.storage.save();
    });

    // Acceptance Checks Runner
    this.listen(document.getElementById('btn-close-tests'), 'click', () => {
      this.hidePanel(this.panelTests);
      this.showPanel(this.panelTitle);
    });
    this.listen(document.getElementById('btn-run-tests-exec'), 'click', () => {
      this.executeAcceptanceTests();
    });
  }

  handleWorldClick(wx, wy) {
    if (this.sim.state !== 'PLAYING' && this.sim.state !== 'TUTORIAL') return;

    // Check click on a train to engage Emergency Brake or Turbo!
    for (const t of this.sim.trains) {
      if (!t.isRemoved && Math.hypot(wx - t.locoPos.x, wy - t.locoPos.y) < 28) {
        if (!t.isBraking) {
          t.toggleBrake(this.audio);
          this.sim.spawnFloatingText('BRAKE!', t.locoPos.x, t.locoPos.y - 25, '#ef4444');
        } else {
          t.engageTurbo(this.audio);
          this.sim.spawnFloatingText('TURBO 2X!', t.locoPos.x, t.locoPos.y - 25, '#fde047');
        }
        return;
      }
    }

    // Check click near Switch A
    if (Math.hypot(wx - this.sim.switchA.x, wy - this.sim.switchA.y) < 38) {
      this.toggleSwitchA();
      return;
    }
    // Check click near Switch B
    if (Math.hypot(wx - this.sim.switchB.x, wy - this.sim.switchB.y) < 38) {
      this.toggleSwitchB();
      return;
    }
    // Check click near Switch C
    if (Math.hypot(wx - this.sim.switchC.x, wy - this.sim.switchC.y) < 38) {
      this.toggleSwitchC();
      return;
    }
    // Check click near North Signal mast
    if (Math.hypot(wx - this.sim.signalN.mastX, wy - this.sim.signalN.mastY) < 36) {
      this.toggleSignalN();
      return;
    }
    // Check click near South Signal mast
    if (Math.hypot(wx - this.sim.signalS.mastX, wy - this.sim.signalS.mastY) < 36) {
      this.toggleSignalS();
      return;
    }
  }

  toggleSwitchA() {
    this.sim.switchA.toggle(this.audio);
    this.updateControlsUI();
  }

  toggleSwitchB() {
    this.sim.switchB.toggle(this.audio);
    this.updateControlsUI();
  }

  toggleSwitchC() {
    this.sim.switchC.toggle(this.audio);
    this.updateControlsUI();
  }

  toggleSignalN() {
    this.sim.signalN.toggle(this.audio);
    this.updateControlsUI();
  }

  toggleSignalS() {
    this.sim.signalS.toggle(this.audio);
    this.updateControlsUI();
  }

  triggerBrakeAction() {
    // Find closest train to merge or inspected train
    let target = this.sim.inspectedTrain?.isRemoved ? null : this.sim.inspectedTrain;
    if (!target) {
      target = this.sim.trains.find(t => !t.isRemoved && (t.stage === 'APPROACH' || t.stage === 'MERGE'));
    }
    if (target) {
      target.toggleBrake(this.audio);
      this.sim.spawnFloatingText(target.isBraking ? 'BRAKE ENGAGED!' : 'RELEASED', target.locoPos.x, target.locoPos.y - 25, '#ef4444');
      this.btnBrake.classList.toggle('active', target.isBraking);
    }
  }

  triggerTurboAction() {
    let target = this.sim.inspectedTrain?.isRemoved ? null : this.sim.inspectedTrain;
    if (!target) {
      target = this.sim.trains.find(t => !t.isRemoved && (t.stage === 'TRUNK' || t.stage === 'BRANCH_1' || t.stage === 'BRANCH_2'));
    }
    if (target) {
      target.engageTurbo(this.audio);
      this.sim.spawnFloatingText('TURBO 2X!', target.locoPos.x, target.locoPos.y - 25, '#fde047');
      this.btnTurbo.classList.add('active');
      // Active state is reconciled from the train on the next HUD update.
    }
  }

  togglePause() {
    if (['PLAYING', 'TUTORIAL'].includes(this.sim.state)) {
      this.pauseGame();
    } else if (this.sim.state === 'PAUSED') {
      this.hideAllPanels();
      this.sim.state = this.resumeState;
      if (this.sim.state === 'TUTORIAL') this.updateTutorialBanner(this.sim.tutorialStep);
    }
  }

  pauseGame() {
    this.resumeState = this.sim.state;
    this.sim.state = 'PAUSED';
    this.showPanel(this.panelPause);
  }

  toggleMute() {
    this.audio.muted = !this.audio.muted;
    this.storage.memoryData.settings.muted = this.audio.muted;
    this.storage.save();
    document.getElementById('mute-icon').textContent = this.audio.muted ? '🔇' : '🔊';
    document.getElementById('toggle-mute-switch').classList.toggle('active', this.audio.muted);
  }

  showPanel(panel) {
    panel.classList.add('active');
  }

  hidePanel(panel) {
    panel.classList.remove('active');
  }

  hideAllPanels() {
    const panels = [
      this.panelTitle, this.panelPause, this.panelWaveClear,
      this.panelVictory, this.panelGameOver, this.panelSettings, this.panelTests
    ];
    panels.forEach(p => p.classList.remove('active'));
    this.tutBanner.classList.remove('visible');
  }

  updateTitleRecords() {
    document.getElementById('title-best-score').textContent = this.storage.memoryData.bestScore.toLocaleString();
    document.getElementById('title-best-wave').textContent = `Wave ${this.storage.memoryData.bestWave}`;
    const btnEndless = document.getElementById('btn-play-endless');
    if (this.storage.memoryData.endlessUnlocked) {
      btnEndless.removeAttribute('disabled');
      btnEndless.textContent = 'Endless Yard (Unlocked)';
    }
  }

  updateTutorialBanner(step) {
    this.tutBanner.classList.add('visible');
    if (step === 1) {
      this.tutStepTitle.textContent = 'Tutorial Step 1 of 4: Track Switching';
      this.tutText.textContent = 'Click Switch B (or press B) to set the route to Amber (▲).';
    } else if (step === 2) {
      this.tutStepTitle.textContent = 'Tutorial Step 2 of 4: Multi-Branch Routing';
      this.tutText.textContent = 'Toggle Switch A to LOWER [A], and Switch C to LIME [C] to route this train to Lime (■)!';
    } else if (step === 3) {
      this.tutStepTitle.textContent = 'Tutorial Step 3 of 4: Merge Collision Prevention';
      this.tutText.textContent = 'Both trains are approaching the merge! Click South Signal [2] to HOLD the South train until North clears.';
    } else if (step === 4) {
      this.tutStepTitle.textContent = 'Tutorial Step 4 of 4: Release Train';
      this.tutText.textContent = 'North train has safely cleared the merge! Click South Signal [2] again to RELEASE the South train.';
    }
  }

  showWaveClear(bonus) {
    document.getElementById('wc-deliveries').textContent = `${this.sim.waveDeliveredCount} / ${this.sim.waveTotalTrains}`;
    document.getElementById('wc-bonus').textContent = `+${bonus}`;
    document.getElementById('wc-streak').textContent = `x${this.sim.streak}`;
    document.getElementById('wc-total-score').textContent = this.sim.score.toLocaleString();
    this.showPanel(this.panelWaveClear);
  }

  showVictory() {
    document.getElementById('vic-score').textContent = this.sim.score.toLocaleString();
    this.showPanel(this.panelVictory);
  }

  showGameOver(reason) {
    document.getElementById('game-over-reason').textContent = reason || 'Incident capacity exceeded.';
    document.getElementById('go-score').textContent = this.sim.score.toLocaleString();
    document.getElementById('go-wave').textContent = this.sim.isEndless ? `Endless W${this.sim.currentWave}` : `Wave ${this.sim.currentWave}`;
    this.showPanel(this.panelGameOver);
  }

  updateHUD() {
    this.valScore.textContent = this.sim.score.toLocaleString();
    this.valStreak.textContent = `x${this.sim.streak}`;
    this.labelWave.textContent = this.sim.isEndless ? 'ENDLESS' : 'WAVE';
    this.valWave.textContent = this.sim.isEndless ? `W${this.sim.currentWave}` : `${this.sim.currentWave}/10`;

    // Rush Hour Fever Mode Badge (Streak >= 5)
    if (this.sim.streak >= 5) {
      this.hudFever.style.display = 'flex';
    } else {
      this.hudFever.style.display = 'none';
    }

    // Hearts display
    const hearts = this.livesContainer.querySelectorAll('.heart-icon');
    hearts.forEach((h, idx) => {
      h.classList.toggle('heart-lost', idx >= this.sim.lives);
    });

    // Incoming Queue Preview list (next 2 scheduled trains)
    const upcoming = this.sim.spawnSchedule.filter(s => !s.spawned).slice(0, 2);
    let html = '';
    for (const item of upcoming) {
      html += `
        <div class="preview-card" style="border-left: 3px solid ${item.destination.color}">
          <span class="badge-entrance">${item.entrance}</span>
          <span style="color: ${item.destination.color}">${item.destination.symbol}</span>
          <span>${item.destination.label}</span>
        </div>
      `;
    }
    if (upcoming.length === 0 && this.sim.state === 'PLAYING') {
      html = '<span style="font-size: 11px; color: #64748b;">Schedule Finished</span>';
    }
    this.previewList.innerHTML = html;

    this.updateControlsUI();
  }

  updateControlsUI() {
    this.btnTurbo.classList.toggle('active', this.sim.trains.some(t => t.isTurbo && !t.isRemoved));
    this.btnBrake.classList.toggle('active', this.sim.trains.some(t => t.isBraking && !t.isRemoved));
    // Sync Button states with simulation objects
    this.txtSigN.textContent = `North: ${this.sim.signalN.isGreen ? 'GO' : 'HOLD'}`;
    this.btnSigN.className = `control-btn ${this.sim.signalN.isGreen ? 'signal-go' : 'signal-stop'}`;

    this.txtSigS.textContent = `South: ${this.sim.signalS.isGreen ? 'GO' : 'HOLD'}`;
    this.btnSigS.className = `control-btn ${this.sim.signalS.isGreen ? 'signal-go' : 'signal-stop'}`;

    this.txtSwA.textContent = `A: ${this.sim.switchA.branches[this.sim.switchA.state]}`;
    this.txtSwB.textContent = `B: ${this.sim.switchB.branches[this.sim.switchB.state]}`;
    this.txtSwC.textContent = `C: ${this.sim.switchC.branches[this.sim.switchC.state]}`;
  }

  executeAcceptanceTests() {
    const results = runChecks();
    document.getElementById('tests-output').textContent = results.map(r => `[${r.passed ? 'PASS' : 'FAIL'}] ${r.name}${r.error ? ': ' + r.error : ''}`).join('\n') + '\n\nLogic checks only. Browser, physical touch, audio and installer acceptance require separate testing.';
  }
}
