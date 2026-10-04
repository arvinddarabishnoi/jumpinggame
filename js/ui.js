import { CAR_CONFIGS } from './player.js';
import { SPRITES } from './assets.js';

export class UI {
  constructor(root, assets, saveState) {
    this.root = root;
    this.assets = assets;
    this.save = saveState;
    this.route = 'menu';
    this.mode = 'career';
    this.onRoute = null;
    this.onAction = null;
    this.onMode = null;
    this.onSelectCar = null;
    this.onUpgrade = null;
    this.onBuyCar = null;
    this.refs = {};
    this.captureRefs();
    this.bind();
    this.refreshAll();
  }

  captureRefs() {
    const ids = ['loadingScreen','menuScreen','garageScreen','missionsScreen','shopScreen','settingsScreen','hud','touchControls','pauseOverlay','gameOverOverlay','toastStack','garagePreview','carRoster','upgradeGrid','missionList','shopList'];
    ids.forEach((id) => { this.refs[id] = document.getElementById(id); });
    this.refs.menuCoins = document.getElementById('menuCoins');
    this.refs.menuBestDistance = document.getElementById('menuBestDistance');
    this.refs.menuBestCombo = document.getElementById('menuBestCombo');
  }

  bind() {
    this.root.querySelectorAll('[data-route]').forEach((button) => button.addEventListener('click', () => this.go(button.dataset.route)));
    this.root.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => this.onAction?.(button.dataset.action)));
    this.root.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => this.selectMode(button.dataset.mode)));
    this.root.querySelectorAll('[data-setting]').forEach((input) => input.addEventListener('change', () => {
      this.save.settings[input.dataset.setting] = input.checked;
      this.onSettingsChanged?.(this.save.settings);
    }));
    this.refs.carRoster.addEventListener('click', (event) => {
      const card = event.target.closest('[data-car-id]'); if (!card) return;
      const id = card.dataset.carId;
      if (this.save.unlockedCars.includes(id)) this.onSelectCar?.(id);
      else this.onBuyCar?.(id);
    });
    this.refs.upgradeGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-upgrade]'); if (!button) return;
      this.onUpgrade?.(button.dataset.upgrade);
    });
    this.refs.shopList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-shop-car]'); if (!button) return;
      const id = button.dataset.shopCar;
      if (this.save.unlockedCars.includes(id)) this.go('garage'); else this.onBuyCar?.(id);
    });
  }

  ready() { this.refs.loadingScreen.classList.remove('active'); this.go('menu'); }

  go(route) {
    this.route = route;
    ['menu','garage','missions','shop','settings'].forEach((name) => this.refs[`${name}Screen`].classList.toggle('active', name === route));
    const inRun = route === 'game';
    this.refs.hud.classList.toggle('active', inRun);
    this.refs.touchControls.style.display = inRun && window.matchMedia('(max-width: 700px)').matches ? 'grid' : '';
    this.refs.pauseOverlay.classList.remove('active'); this.refs.gameOverOverlay.classList.remove('active');
    this.onRoute?.(route);
    if (route === 'garage') this.renderGarage();
    if (route === 'missions') this.renderMissions();
    if (route === 'shop') this.renderShop();
    if (route === 'settings') this.renderSettings();
    this.refreshMenuStats();
  }

  selectMode(mode) {
    this.mode = mode;
    this.root.querySelectorAll('[data-mode]').forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
    this.onMode?.(mode);
  }

  setInRun(active) {
    this.refs.hud.classList.toggle('active', active);
    if (active) {
      this.refs.gameOverOverlay.classList.remove('active');
      this.refs.pauseOverlay.classList.remove('active');
    }
    this.refs.touchControls.style.display = active && window.matchMedia('(max-width: 700px)').matches ? 'grid' : 'none';
    if (active) {
      ['menu','garage','missions','shop','settings'].forEach((name) => this.refs[`${name}Screen`].classList.remove('active'));
    }
  }

  setPause(active) {
    this.refs.pauseOverlay.classList.toggle('active', active);
    this.refs.pauseOverlay.setAttribute('aria-hidden', String(!active));
  }

  showResults(summary) {
    this.refs.gameOverOverlay.classList.add('active');
    this.refs.gameOverOverlay.setAttribute('aria-hidden', 'false');
    document.getElementById('resultKicker').textContent = summary.complete ? 'SECTOR COMPLETE / SIGNAL LOCKED' : summary.reason || 'RUN TERMINATED / WRECK';
    document.getElementById('resultTitle').innerHTML = summary.complete ? 'SECTOR <em>CLAIMED</em>' : 'THE MOUNTAIN <em>WINS</em>';
    document.getElementById('resultSubtitle').textContent = summary.complete ? 'The next line is already moving. Tune up and push deeper.' : summary.subtitle || 'Your rig held the line for as long as it could.';
    document.getElementById('resultDistance').textContent = `${Math.floor(summary.distance).toLocaleString()} M`;
    document.getElementById('resultScore').textContent = Math.floor(summary.score).toLocaleString();
    document.getElementById('resultCoins').textContent = Math.floor(summary.coins).toLocaleString();
    document.getElementById('resultCombo').textContent = `${summary.bestCombo.toFixed(1)}X`;
    document.getElementById('newRecord').classList.toggle('visible', summary.newRecord);
  }

  toast(text, tone = '') {
    const el = document.createElement('div'); el.className = `toast ${tone}`; el.textContent = text;
    this.refs.toastStack.appendChild(el); setTimeout(() => el.remove(), 1700);
  }

  updateHud(data) {
    const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    const meter = (id, value) => { const node = document.getElementById(id); if (node) node.style.width = `${Math.max(0, Math.min(100, value))}%`; };
    set('distanceValue', Math.floor(data.distance).toLocaleString());
    set('scoreValue', Math.floor(data.score).toLocaleString());
    set('fuelValue', Math.ceil(data.fuel)); meter('fuelMeter', data.fuel);
    set('gravityValue', Math.ceil(data.gravityEnergy)); meter('gravityMeter', data.gravityEnergy);
    set('nitroValue', Math.ceil(data.nitro)); meter('nitroMeter', data.nitro);
    set('worldPill', data.worldLabel);
    set('missionHudText', data.missionText); set('missionHudProgress', `${Math.floor(data.missionProgress)}%`); meter('missionMeter', data.missionProgress);
    set('comboValue', `${data.combo.toFixed(1)}X`);
    document.getElementById('comboReadout')?.classList.toggle('hot', data.combo > 1.01);
    set('runStatusText', data.status);
    const gravityChip = document.getElementById('gravityModeChip');
    gravityChip.classList.toggle('visible', data.gravityMode !== 'normal' || data.gravityPulse > 0);
    gravityChip.querySelector('b').textContent = data.gravityMode === 'reverse' ? 'REVERSE GRAVITY' : data.gravityMode === 'low' ? 'LOW GRAVITY' : 'NORMAL GRAVITY';
  }

  refreshAll() { this.refreshMenuStats(); this.renderGarage(); this.renderMissions(); this.renderShop(); this.renderSettings(); }
  refreshMenuStats() {
    if (this.refs.menuCoins) this.refs.menuCoins.textContent = this.save.coins.toLocaleString();
    if (this.refs.menuBestDistance) this.refs.menuBestDistance.textContent = `${Math.floor(this.save.bestDistance).toLocaleString()} M`;
    if (this.refs.menuBestCombo) this.refs.menuBestCombo.textContent = `${this.save.bestCombo.toFixed(1)}X`;
    const ids = ['garageCoins','shopCoins']; ids.forEach((id) => { const n = document.getElementById(id); if (n) n.textContent = this.save.coins.toLocaleString(); });
    const stars = document.getElementById('missionStars'); if (stars) stars.textContent = this.save.missionStars || 0;
  }

  renderGarage() {
    if (!this.refs.carRoster) return;
    this.refs.carRoster.innerHTML = Object.entries(CAR_CONFIGS).map(([id, car]) => {
      const unlocked = this.save.unlockedCars.includes(id);
      return `<button class="car-card ${id === this.save.selectedCar ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-car-id="${id}"><canvas width="180" height="82" data-car-canvas="${id}"></canvas><b>${car.name}</b><small class="${unlocked ? '' : 'lock-label'}">${unlocked ? car.className : `${car.unlock} COINS`}</small></button>`;
    }).join('');
    this.drawCarCanvases();
    const config = CAR_CONFIGS[this.save.selectedCar] || CAR_CONFIGS.trailblazer;
    document.getElementById('garageCarName').textContent = config.name;
    document.getElementById('garageCarClass').textContent = config.className;
    document.getElementById('garageCarLevel').textContent = `LV. ${String(this.save.upgrades.engine || 1).padStart(2, '0')}`;
    this.drawGaragePreview();
    const icons = { engine: '↯', grip: '◎', suspension: '↕', fuel: '▣', nitro: 'N', armor: '⬟', airControl: '✧', gravity: '◈' };
    const labels = { engine: 'ENGINE', grip: 'GRIP', suspension: 'SUSPENSION', fuel: 'FUEL TANK', nitro: 'NITRO', armor: 'ARMOR', airControl: 'AIR CONTROL', gravity: 'GRAVITY CORE' };
    this.refs.upgradeGrid.innerHTML = Object.keys(labels).map((key) => {
      const level = Math.min(5, this.save.upgrades[key] || 1); const cost = 100 * level + (key === 'gravity' ? 40 : 0);
      const bars = Array.from({ length: 5 }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
      return `<div class="upgrade-card"><div class="upgrade-icon">${icons[key]}</div><div><h4>${labels[key]}</h4><p>LEVEL ${level} / 05</p><div class="upgrade-level">${bars}</div></div><button class="upgrade-buy ${level >= 5 ? 'max' : ''}" data-upgrade="${key}">${level >= 5 ? 'MAX' : `◉ ${cost}`}</button></div>`;
    }).join('');
  }

  drawCarCanvases() {
    this.refs.carRoster.querySelectorAll('[data-car-canvas]').forEach((canvas) => {
      const ctx = canvas.getContext('2d'); const id = canvas.dataset.carCanvas; const car = CAR_CONFIGS[id]; const image = this.assets.get('cars'); const region = SPRITES.cars[car.sprite];
      ctx.clearRect(0,0,180,82); ctx.globalAlpha = .2; ctx.fillStyle = car.color; ctx.beginPath(); ctx.ellipse(90,60,60,8,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
      this.assets.draw(ctx, 'cars', region, 90, 43, car.sprite === 'titan' ? 92 : 102, car.sprite === 'titan' ? 66 : 61, 0, 1);
    });
  }

  drawGaragePreview() {
    const canvas = this.refs.garagePreview; if (!canvas) return;
    const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h);
    const grad = ctx.createLinearGradient(0,0,0,h); grad.addColorStop(0,'rgba(30,79,91,.08)');grad.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(109,232,255,.11)';ctx.lineWidth=1;for(let x=0;x<w;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=20;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    const car = CAR_CONFIGS[this.save.selectedCar] || CAR_CONFIGS.trailblazer; this.assets.draw(ctx,'cars',SPRITES.cars[car.sprite],w*.5,h*.53, car.sprite==='titan'?270:290, car.sprite==='titan'?205:180, -0.025, 1);
    ctx.fillStyle='rgba(199,245,91,.75)';ctx.fillRect(w*.12,h*.72,w*.76,2);ctx.fillStyle='rgba(109,232,255,.28)';ctx.fillRect(w*.2,h*.72,w*.12,2);ctx.fillRect(w*.72,h*.72,w*.08,2);
  }

  renderMissions() {
    const missions = this.save.missions || [];
    const completed = this.save.completedMissions || [];
    this.refs.missionList.innerHTML = missions.map((m) => {
      const done = completed.includes(m.id); const progress = done ? 100 : 0;
      return `<article class="mission-card ${done ? 'complete' : ''}"><div class="mission-symbol">${m.icon}</div><div><h3>${m.title}</h3><p>${m.description}</p><div class="mission-progress"><i style="width:${progress}%"></i></div></div><div class="mission-reward"><strong>+${m.reward}</strong><small>${done ? 'CLAIMED' : 'COINS'}</small></div></article>`;
    }).join('');
    const count = completed.filter((id) => missions.some((m) => m.id === id)).length;
    document.getElementById('missionRewardText').textContent = `${count} / ${missions.length} OBJECTIVES COMPLETE`;
    document.getElementById('missionRewardFill').style.width = `${missions.length ? count / missions.length * 100 : 0}%`;
    this.refreshMenuStats();
  }

  renderShop() {
    if (!this.refs.shopList) return;
    this.refs.shopList.innerHTML = Object.entries(CAR_CONFIGS).map(([id, car]) => {
      const unlocked = this.save.unlockedCars.includes(id); const cost = car.unlock || 0;
      return `<article class="shop-rig ${unlocked ? 'unlocked' : ''}"><h4>${car.name}</h4><p>${car.className}<br>${unlocked ? 'READY FOR DEPLOYMENT' : `UNLOCK AT ${cost} COINS`}</p><canvas width="190" height="105" data-shop-canvas="${id}"></canvas><button data-shop-car="${id}">${unlocked ? 'TUNE RIG ↗' : `UNLOCK ◉ ${cost}`}</button></article>`;
    }).join('');
    this.refs.shopList.querySelectorAll('[data-shop-canvas]').forEach((canvas) => {
      const id = canvas.dataset.shopCanvas, car = CAR_CONFIGS[id], ctx = canvas.getContext('2d'); ctx.clearRect(0,0,190,105); this.assets.draw(ctx,'cars',SPRITES.cars[car.sprite],95,57,150,100,0,1);
    });
  }

  renderSettings() {
    this.root.querySelectorAll('[data-setting]').forEach((input) => { input.checked = Boolean(this.save.settings[input.dataset.setting]); });
  }
}
