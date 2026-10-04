import { AssetStore } from './assets.js';
import { loadSave, saveProgress } from './save.js';
import { InputManager } from './input.js';
import { AudioManager } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { CAR_CONFIGS } from './player.js';

const canvas = document.getElementById('gameCanvas');
const save = loadSave();
const assets = new AssetStore();

async function boot() {
  try {
    await assets.load();
    const input = new InputManager(document);
    const audio = new AudioManager(save.settings);
    const ui = new UI(document, assets, save);
    const game = new Game({ canvas, assets, save, input, ui, audio });

    ui.onRoute = (route) => game.onRoute(route);
    ui.onAction = (action) => game.handleUiAction(action);
    ui.onMode = (mode) => { audio.event('click'); game.mode = mode; };
    ui.onSettingsChanged = (settings) => {
      game.renderer.settings = settings;
      game.particles.settings = settings;
      saveProgress(save);
    };
    ui.onSelectCar = (id) => {
      save.selectedCar = id;
      saveProgress(save);
      audio.event('click');
      ui.renderGarage();
      ui.toast(`${id.toUpperCase()} SELECTED`);
    };
    ui.onBuyCar = (id) => {
      const config = CAR_CONFIGS[id];
      if (!config || save.unlockedCars.includes(id)) return;
      if (save.coins < config.unlock) { ui.toast(`NEED ${config.unlock} COINS`, 'orange'); return; }
      save.coins -= config.unlock;
      save.unlockedCars.push(id);
      save.selectedCar = id;
      saveProgress(save);
      audio.event('complete');
      ui.refreshAll();
      ui.toast(`${config.name} UNLOCKED`, 'purple');
    };
    ui.onUpgrade = (key) => {
      const level = save.upgrades[key] || 1;
      const cost = 100 * level + (key === 'gravity' ? 40 : 0);
      if (level >= 5) { ui.toast('SYSTEM AT MAX LEVEL', 'orange'); return; }
      if (save.coins < cost) { ui.toast(`NEED ${cost} COINS`, 'orange'); return; }
      save.coins -= cost; save.upgrades[key] = level + 1;
      saveProgress(save); audio.event('complete'); ui.renderGarage(); ui.refreshMenuStats(); ui.toast(`${key.replace(/([A-Z])/g, ' $1').toUpperCase()} LV. ${level + 1}`, 'purple');
    };

    document.addEventListener('pointerdown', () => audio.init(), { once: false, passive: true });
    window.addEventListener('beforeunload', () => saveProgress(save));
    window.addEventListener('resize', () => { if (ui.route === 'game') ui.setInRun(true); });
    document.body.classList.toggle('high-contrast', Boolean(save.settings.highContrast));
    ui.ready();
  } catch (error) {
    console.error(error);
    document.getElementById('loadingScreen').innerHTML = '<div class="modal-card"><div class="modal-kicker">ASSET LINK ERROR</div><h2>CAN’T <em>LOAD</em></h2><p>Refresh the expedition to reconnect the authored vehicle atlas.</p></div>';
  }
}

boot();
