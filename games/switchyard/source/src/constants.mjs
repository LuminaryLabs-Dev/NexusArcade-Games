export const WORLD_W = 1200;
export const WORLD_H = 720;
export const SIM_DT = 1 / 60; // 60Hz fixed simulation step

export const STATIONS = {
  AMBER: {
    id: 'AMBER',
    label: 'AMBER',
    symbol: '▲',
    color: '#f59e0b',
    glow: '#fde68a',
    dark: '#b45309',
    x: 1050,
    y: 130
  },
  CYAN: {
    id: 'CYAN',
    label: 'CYAN',
    symbol: '●',
    color: '#06b6d4',
    glow: '#a5f3fc',
    dark: '#0e7490',
    x: 1050,
    y: 290
  },
  MAGENTA: {
    id: 'MAGENTA',
    label: 'MAGENTA',
    symbol: '◆',
    color: '#ec4899',
    glow: '#fbcfe8',
    dark: '#be185d',
    x: 1050,
    y: 430
  },
  LIME: {
    id: 'LIME',
    label: 'LIME',
    symbol: '■',
    color: '#84cc16',
    glow: '#d9f99d',
    dark: '#4d7c0f',
    x: 1050,
    y: 590
  }
};

export const TRAIN_DIMS = {
  locoLength: 32,
  locoWidth: 16,
  carLength: 26,
  carWidth: 15,
  gap: 14,
  carOffset: 46 // Distance from locomotive front to carriage center
};

// =============================================================================
// SECTION 2: AUDIO SYSTEM (Web Audio API Synthesizer)
// =============================================================================
