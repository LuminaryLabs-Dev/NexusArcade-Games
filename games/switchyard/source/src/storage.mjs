export class StorageManager {
  constructor(adapter) {
    this.adapter = adapter;
    this.storageKey = 'switchyard_arcade_v1';
    this.memoryData = {
      bestScore: 0,
      bestWave: 1,
      endlessUnlocked: false,
      tutorialCompleted: false,
      settings: {
        muted: false,
        volume: 70,
        reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
      }
    };
    this.load();
  }

  load() {
    try {
      const raw = (this.adapter ?? globalThis.localStorage).getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        for (const key of ['bestScore', 'bestWave']) {
          if (Number.isFinite(parsed[key]) && parsed[key] >= 0) this.memoryData[key] = Math.floor(parsed[key]);
        }
        for (const key of ['endlessUnlocked', 'tutorialCompleted']) {
          if (typeof parsed[key] === 'boolean') this.memoryData[key] = parsed[key];
        }
        const settings = parsed.settings;
        if (settings && typeof settings === 'object') {
          for (const key of ['muted', 'reducedMotion']) if (typeof settings[key] === 'boolean') this.memoryData.settings[key] = settings[key];
          const volume = Number(settings.volume);
          if (Number.isFinite(volume)) this.memoryData.settings.volume = Math.min(100, Math.max(0, volume));
        }
      }
    } catch (e) {
      // Storage unavailable or sandboxed: continue in memory
    }
  }

  save() {
    try {
      (this.adapter ?? globalThis.localStorage).setItem(this.storageKey, JSON.stringify(this.memoryData));
    } catch (e) {
      // In-memory fallback
    }
  }

  updateRecord(score, wave) {
    let changed = false;
    if (score > this.memoryData.bestScore) {
      this.memoryData.bestScore = score;
      changed = true;
    }
    if (wave > this.memoryData.bestWave) {
      this.memoryData.bestWave = wave;
      changed = true;
    }
    if (changed) this.save();
  }
}

// =============================================================================
// SECTION 4: PATH GEOMETRY & TRACK TOPOLOGY
// =============================================================================
