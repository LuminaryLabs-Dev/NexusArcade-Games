export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.7;
    this.lastWarnTime = 0;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try { this.ctx = new AudioCtx(); } catch { return; }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playSwitchClick() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    gain.gain.setValueAtTime(0.35 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  playSwitchLocked() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.setValueAtTime(140, now + 0.03);

    gain.gain.setValueAtTime(0.2 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  playSignalToggle(isGreen) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = isGreen ? 660 : 330;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.08);

    gain.gain.setValueAtTime(0.25 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playArrivalChime(streak) {
    if (this.muted || !this.ctx) return;
    const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]; // Pentatonic scale
    const baseFreq = notes[Math.min(streak, notes.length - 1)];
    const now = this.ctx.currentTime;

    [baseFreq, baseFreq * 1.5].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.04);

      gain.gain.setValueAtTime(0.3 * this.volume, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + idx * 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + 0.4);
    });
  }

  playWrongStation() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.22);

    gain.gain.setValueAtTime(0.35 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playCollisionCrash() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Deep punch tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
    oscGain.gain.setValueAtTime(0.5 * this.volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);

    // Filtered noise buffer for impact crunch
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4 * this.volume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
  }

  playNearConflictAlert() {
    if (this.muted || !this.ctx) return;
    const now = performance.now();
    if (now - this.lastWarnTime < 1800) return; // Throttle to prevent audio clutter
    this.lastWarnTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, t);
    osc.frequency.setValueAtTime(440, t + 0.08);

    gain.gain.setValueAtTime(0.2 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  playWaveFanfare() {
    if (this.muted || !this.ctx) return;
    const notes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.25 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  playTrainWhistle() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Classic two-tone steam whistle chord (D5 & F#5)
    [587.33, 739.99].forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 1.03, now + 0.18);

      gain.gain.setValueAtTime(0.18 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  playBrakeScreech() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.2);

    gain.gain.setValueAtTime(0.16 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  playNearMissBonus() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Ascending high chime for close-call bonus
    [880, 1174.66, 1760].forEach((freq, idx) => {
      const t = now + idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.27);
    });
  }
}

// =============================================================================
// SECTION 3: STORAGE PERSISTENCE
// =============================================================================
