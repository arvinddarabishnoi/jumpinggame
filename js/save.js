const STORAGE_KEY = 'gravity-run-save-v1';

const defaults = {
  coins: 420,
  totalCoins: 420,
  bestDistance: 0,
  bestScore: 0,
  bestCombo: 0,
  bestStunt: 0,
  unlockedCars: ['trailblazer'],
  selectedCar: 'trailblazer',
  upgrades: {
    engine: 1,
    grip: 1,
    suspension: 1,
    fuel: 1,
    nitro: 1,
    armor: 1,
    airControl: 1,
    gravity: 1
  },
  missionStars: 0,
  completedMissions: [],
  missions: [
    { id: 'distance', type: 'distance', title: 'Reach 1,500 meters', description: 'Hold your line through the first sector.', target: 1500, reward: 180, icon: '↗' },
    { id: 'coins', type: 'coins', title: 'Collect 25 coins', description: 'Take the high line and strip the ridge.', target: 25, reward: 120, icon: '●' },
    { id: 'flips', type: 'flips', title: 'Land 2 clean flips', description: 'Air time is only valuable if you stick it.', target: 2, reward: 220, icon: '⟳' }
  ],
  settings: {
    sound: true,
    ambience: true,
    screenShake: true,
    reducedMotion: false,
    highContrast: false
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  Object.keys(base).forEach((key) => {
    if (!(key in incoming)) return;
    if (base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      base[key] = merge(base[key], incoming[key]);
    } else {
      base[key] = incoming[key];
    }
  });
  return base;
}

export function loadSave() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { data = null; }
  const state = merge(clone(defaults), data || {});
  // Defensive normalization prevents a corrupted local save from poisoning physics/UI.
  state.coins = Number.isFinite(state.coins) ? Math.max(0, Math.floor(state.coins)) : defaults.coins;
  state.totalCoins = Number.isFinite(state.totalCoins) ? Math.max(state.coins, Math.floor(state.totalCoins)) : state.coins;
  state.bestDistance = Number.isFinite(state.bestDistance) ? Math.max(0, state.bestDistance) : 0;
  state.bestScore = Number.isFinite(state.bestScore) ? Math.max(0, state.bestScore) : 0;
  state.bestCombo = Number.isFinite(state.bestCombo) ? Math.max(0, state.bestCombo) : 0;
  state.bestStunt = Number.isFinite(state.bestStunt) ? Math.max(0, state.bestStunt) : 0;
  state.unlockedCars = Array.isArray(state.unlockedCars) && state.unlockedCars.length ? state.unlockedCars : ['trailblazer'];
  state.selectedCar = state.unlockedCars.includes(state.selectedCar) ? state.selectedCar : 'trailblazer';
  return state;
}

export function saveProgress(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing and quota errors should not stop a run.
  }
}

export function resetSave() {
  const state = clone(defaults);
  saveProgress(state);
  return state;
}

export function getDefaultMissions() { return clone(defaults.missions); }
