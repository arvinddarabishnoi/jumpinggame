import { Terrain } from './terrain.js';
import { Player } from './player.js';
import { ParticleSystem } from './particles.js';
import { Renderer } from './renderer.js';
import { SPRITES } from './assets.js';
import { saveProgress } from './save.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class Game {
  constructor({ canvas, assets, save, input, ui, audio }) {
    this.canvas = canvas;
    this.assets = assets;
    this.save = save;
    this.input = input;
    this.ui = ui;
    this.audio = audio;
    this.terrain = new Terrain();
    this.particles = new ParticleSystem(save.settings);
    this.renderer = new Renderer(canvas, assets, this.terrain, this.particles, save.settings);
    this.player = new Player();
    this.previewPlayer = new Player();
    this.previewPlayer.configure('skyline');
    this.previewPlayer.grounded = false;
    this.camera = { x: 0, y: -70, shake: 0 };
    this.time = 0;
    this.lastFrame = performance.now();
    this.mode = 'career';
    this.active = false;
    this.paused = false;
    this.finished = false;
    this.rewinding = false;
    this.snapshots = [];
    this.rewindCursor = 0;
    this.snapshotTimer = 0;
    this.rewindTimer = 0;
    this.collectibles = [];
    this.collected = new Set();
    this.floatingTexts = [];
    this.powerupTimers = {};
    this.gravityMode = 'normal';
    this.gravityTimer = 0;
    this.gravityCooldown = 0;
    this.gravityEnergy = 100;
    this.gravityPulse = 0;
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.fuel = 100;
    this.score = 0;
    this.runCoins = 0;
    this.runCoinPickups = 0;
    this.runFlips = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.bestComboRun = 1;
    this.bestStuntRun = 0;
    this.airStartAngle = 0;
    this.airRotation = 0;
    this.airStartX = 0;
    this.airStartY = 0;
    this.runTime = 0;
    this.status = 'SECTOR 01 // DRIVE';
    this.runMission = null;
    this._raf = requestAnimationFrame((now) => this.loop(now));
  }

  loop(now) {
    const dt = Math.min(.034, Math.max(.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    this.handleEdgeActions();
    if (this.active && !this.paused && !this.finished) this.update(dt);
    else if (!this.active) this.updatePreview(dt);
    this.particles.update(dt);
    this.updateFloaters(dt);
    this.camera.shake = Math.max(0, this.camera.shake - dt * 22);
    this.gravityPulse = Math.max(0, this.gravityPulse - dt);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.renderer.render(this, !this.active);
    this.input.endFrame();
    this._raf = requestAnimationFrame((next) => this.loop(next));
  }

  handleEdgeActions() {
    if (this.input.consume('pause')) {
      if (this.active && !this.finished) this.togglePause();
    }
    if (!this.active || this.paused || this.finished) return;
    if (this.input.consume('gravity')) this.activateGravity();
    if (this.input.consume('rewind')) this.startRewind();
  }

  updatePreview(dt) {
    this.previewPlayer.angle = Math.sin(this.time * 1.3) * .035;
    this.previewPlayer.x = 700 + Math.sin(this.time * .23) * 25;
    this.previewPlayer.y = 203 + Math.sin(this.time * 1.8) * 3;
    this.camera.x = lerp(this.camera.x, 100, dt * 2);
    this.camera.y = lerp(this.camera.y, -85, dt * 2);
  }

  start(mode = 'career') {
    this.mode = mode;
    this.active = true; this.paused = false; this.finished = false; this.rewinding = false;
    this.terrain.reset();
    this.player.configure(this.save.selectedCar);
    const startY = (this.terrain.heightAt(160) || 160) + 58;
    this.player.reset(160, startY);
    this.player.nitro = 100;
    this.fuel = 100;
    this.gravityEnergy = 100;
    this.gravityMode = 'normal'; this.gravityTimer = 0; this.gravityCooldown = 0;
    this.gravityPulse = 0; this.flash = 0;
    this.score = 0; this.runCoins = 0; this.runCoinPickups = 0; this.runFlips = 0; this.combo = 1; this.comboTimer = 0; this.bestComboRun = 1; this.bestStuntRun = 0;
    this.airStartAngle = 0; this.airRotation = 0; this.airStartX = this.player.x; this.airStartY = this.player.y;
    this.runTime = 0; this.snapshotTimer = 0; this.rewindTimer = 0; this.snapshots = [];
    this.collected = new Set(); this.floatingTexts = []; this.powerupTimers = {};
    this.buildCollectibles();
    this.camera.x = 0; this.camera.y = -70; this.camera.shake = 0;
    this.status = this.mode === 'stunt' ? 'STUNT RUN // BUILD COMBO' : this.mode === 'time' ? 'TIME TRIAL // 90 SEC' : 'SECTOR 01 // DRIVE';
    this.runMission = this.pickRunMission();
    this.ui.setInRun(true);
    this.ui.setPause(false);
    this.ui.updateHud(this.hudData());
    this.audio.init();
    this.audio.event('click');
    this.particles.emit(this.player.x, this.player.y - 20, 'dust', 12, { angle: Math.PI, speed: 28, life: .6, size: 3 });
  }

  pickRunMission() {
    const missions = this.save.missions || [];
    const next = missions.find((mission) => !(this.save.completedMissions || []).includes(mission.id));
    return next || missions[0] || { type: 'distance', target: 1500, title: 'Reach 1,500 meters' };
  }

  buildCollectibles() {
    this.collectibles = [];
    let lastHeight = 175;
    let id = 0;
    for (let x = 310; x < 36000; x += 118) {
      const ground = this.terrain.heightAt(x);
      if (ground !== null) lastHeight = ground;
      const highLine = id % 7 === 2 || id % 11 === 5;
      const y = (ground ?? lastHeight) + (highLine ? 76 : 44);
      this.collectibles.push({ id: `c${id}`, x, y, kind: id % 13 === 0 ? 'gem' : 'coin', sheet: 'collectibles', sprite: id % 13 === 0 ? (id % 26 === 0 ? 'gemPurple' : 'gemBlue') : (id % 5 === 0 ? 'coinGold' : 'coin'), phase: id * .71 });
      if (id % 10 === 4 && ground !== null) this.collectibles.push({ id: `f${id}`, x: x + 26, y: ground + 46, kind: 'fuel', sheet: 'collectibles', sprite: 'fuel', phase: id * .3 });
      if (id % 14 === 8 && ground !== null) this.collectibles.push({ id: `e${id}`, x: x + 19, y: ground + 63, kind: 'energy', sheet: 'collectibles', sprite: 'energy', phase: id * .24 });
      if (id % 17 === 6 && ground !== null) {
        const power = ['nitro', 'magnet', 'shield', 'superJump'][Math.floor(id / 17) % 4];
        this.collectibles.push({ id: `p${id}`, x: x + 45, y: ground + 72, kind: 'power', power, sheet: 'powerups', sprite: power, phase: id * .18 });
      }
      id += 1;
    }
  }

  update(dt) {
    this.runTime += dt;
    if (this.rewinding) { this.updateRewind(dt); return; }
    this.gravityCooldown = Math.max(0, this.gravityCooldown - dt);
    if (this.gravityMode !== 'normal') {
      this.gravityTimer -= dt;
      if (this.gravityMode === 'reverse' && this.gravityTimer < 1.2) this.status = 'GRAVITY // RETURNING';
      if (this.gravityTimer <= 0) this.setGravity('normal', true);
    }
    Object.keys(this.powerupTimers).forEach((key) => {
      this.powerupTimers[key] -= dt;
      if (this.powerupTimers[key] <= 0) { delete this.powerupTimers[key]; this.player.effects[key] = false; this.ui.toast(`${key.replace(/([A-Z])/g, ' $1').toUpperCase()} EXPIRED`, ''); }
    });
    if (this.comboTimer > 0) this.comboTimer -= dt;
    else if (this.combo > 1) this.combo = Math.max(1, this.combo - dt * .55);

    const controls = {
      accelerate: this.input.isDown('accelerate'), reverse: this.input.isDown('reverse'),
      airFront: this.input.isDown('airFront'), airBack: this.input.isDown('airBack'),
      nitro: this.input.isDown('nitro')
    };
    const before = this.player.getState();
    const result = this.player.update(dt, controls, this.terrain, this.gravityMode, this.save.upgrades, this.particles, this.audio);
    if (controls.nitro && result.wasNitro) this.player.effects.nitro = true; else this.player.effects.nitro = false;

    const stats = this.player.stats(this.save.upgrades);
    this.fuel = Math.max(0, this.fuel - dt * (1.15 + (controls.accelerate ? .6 : 0) + Math.abs(this.player.vx) / 1500) / stats.fuel);
    if (this.gravityMode === 'normal' && this.player.grounded) this.gravityEnergy = clamp(this.gravityEnergy + dt * 1.9 * stats.gravity, 0, 100);
    if (this.gravityMode !== 'normal') this.gravityEnergy = Math.max(0, this.gravityEnergy - dt * 5.2 / stats.gravity);

    this.processAir(before, result);
    this.collectNearby();
    this.updateCamera(dt);
    this.updateRunState(dt);
    this.captureSnapshot(dt);
    this.updateHudThrottled(dt);

    if (this.fuel <= 0) this.finishRun(false, 'OUT OF FUEL', 'You ran the tank dry. The next line needs a smarter route.');
    if (this.player.healthState === 'WRECK') this.finishRun(false, 'CRITICAL DAMAGE / WRECK', 'The impact broke the chassis. Your telemetry still made it home.');
    if (this.player.y < -260) this.finishRun(false, 'SIGNAL LOST / FALLEN', 'The landing zone was just out of reach.');
    this.input.endFrame();
  }

  processAir(before, result) {
    if (result.previousGrounded && !this.player.grounded) {
      this.airStartAngle = this.player.angle; this.airRotation = 0; this.airStartX = this.player.x; this.airStartY = this.player.y;
      this.audio.event('jump'); this.status = 'AIRBORNE // STEER';
      this.particles.emit(this.player.x, this.player.y - 24, 'dust', 6, { angle: Math.PI * .75, speed: 25, life: .35, size: 2 });
    }
    if (!this.player.grounded) this.airRotation = this.player.angle - this.airStartAngle;
    if (!result.previousGrounded && this.player.grounded) this.landStunt();
  }

  landStunt() {
    const rotations = Math.abs(this.airRotation);
    const flips = Math.floor(rotations / (Math.PI * 2));
    const longJump = Math.abs(this.player.x - this.airStartX) > 210;
    const perfect = this.player.lastImpact < 105 && this.player.airtime > .3;
    let points = 0; let labels = [];
    if (flips > 0) {
      const label = this.airRotation > 0 ? 'FRONT FLIP' : 'BACK FLIP';
      labels.push(`${flips > 1 ? `${flips}X ` : ''}${label}`);
      points += flips * 100;
      this.runFlips += flips; this.bestStuntRun = Math.max(this.bestStuntRun, flips);
    }
    if (longJump) { labels.push('LONG JUMP'); points += 80; }
    if (perfect) { labels.push('PERFECT LANDING'); points += 150; }
    if (!labels.length) { this.combo = Math.max(1, this.combo - .15); return; }
    const multiplier = Math.max(1, this.combo);
    points = Math.round(points * multiplier);
    this.score += points;
    this.combo = clamp(this.combo + .35 + flips * .35, 1, 8);
    this.comboTimer = 4.5;
    this.bestComboRun = Math.max(this.bestComboRun, this.combo);
    this.ui.toast(`${labels.join('  +  ')}  +${points}`, perfect ? '' : 'orange');
    this.addFloater(`+${points}`, this.player.x, this.player.y + 62, perfect ? '#c7f55b' : '#ffd27b');
    this.audio.event('stunt');
    this.particles.burst(this.player.x, this.player.y - 20, 'spark', Math.min(2.2, 1 + flips * .3));
    this.camera.shake = Math.max(this.camera.shake, perfect ? 2 : 4);
    this.updateMissionRuntime();
  }

  collectNearby() {
    for (const item of this.collectibles) {
      if (this.collected.has(item.id)) continue;
      const dx = item.x - this.player.x, dy = item.y - this.player.y;
      const radius = this.player.effects.magnet && item.kind !== 'power' ? 150 : 38;
      if (dx * dx + dy * dy > radius * radius) continue;
      this.collected.add(item.id);
      if (item.kind === 'coin' || item.kind === 'gem') {
        this.runCoinPickups += 1;
        const value = item.kind === 'gem' ? 50 : 10;
        const doubled = this.player.effects.doubleCoin ? 2 : 1;
        const earned = value * doubled;
        this.runCoins += earned; this.score += earned; this.audio.event('coin');
        this.addFloater(`+${earned}`, item.x, item.y + 28, item.kind === 'gem' ? '#8de4ff' : '#ffd86f');
        this.particles.burst(item.x, item.y, 'coin', 1);
      } else if (item.kind === 'fuel') {
        this.fuel = clamp(this.fuel + 28, 0, 100); this.score += 25; this.audio.event('fuel'); this.ui.toast('FUEL +28'); this.particles.burst(item.x, item.y, 'spark', 1);
      } else if (item.kind === 'energy') {
        this.gravityEnergy = clamp(this.gravityEnergy + 30, 0, 100); this.score += 30; this.audio.event('energy'); this.ui.toast('GRAVITY CORE +30', 'purple'); this.particles.burst(item.x, item.y, 'gravity', 1);
      } else if (item.kind === 'power') this.activatePowerup(item);
      this.updateMissionRuntime();
    }
  }

  activatePowerup(item) {
    const key = item.power;
    const map = { nitro: 'NITRO BOOST', magnet: 'MAGNET', shield: 'SHIELD', superJump: 'SUPER JUMP' };
    this.powerupTimers[key] = key === 'shield' ? 10 : 8;
    this.player.effects[key] = true;
    if (key === 'nitro') this.player.nitro = clamp(this.player.nitro + 70, 0, 100);
    if (key === 'superJump') this.player.vy += 230;
    this.score += 60; this.audio.event('energy'); this.ui.toast(`${map[key]} ONLINE`, 'purple'); this.particles.burst(item.x, item.y, 'gravity', 1.1);
  }

  updateRunState() {
    const distance = this.distance;
    if (this.mode === 'career' && distance >= 1500) this.finishRun(true, 'SECTOR COMPLETE', 'The green hills are behind you. The desert is already shifting.');
    if (this.mode === 'time' && this.runTime >= 90) this.finishRun(distance >= 900, distance >= 900 ? 'TIME TRIAL CLEAR' : 'TIME EXPIRED', distance >= 900 ? 'You held the line under pressure.' : 'The clock found the gap before you did.');
    if (this.mode === 'stunt' && this.runFlips >= 5) this.finishRun(true, 'STUNT RUN CLEAR', 'Five clean rotations. The mountain is now your launchpad.');
    this.updateMissionRuntime();
  }

  updateMissionRuntime() {
    const mission = this.runMission; if (!mission) return;
    const value = mission.type === 'distance' ? this.distance : mission.type === 'coins' ? this.runCoinPickups : this.runFlips;
    const progress = clamp(value / mission.target * 100, 0, 100);
    this.currentMissionValue = value; this.currentMissionProgress = progress;
    if (value >= mission.target && !(this.save.completedMissions || []).includes(mission.id)) {
      this.save.completedMissions = [...(this.save.completedMissions || []), mission.id];
      this.save.missionStars = (this.save.missionStars || 0) + 1;
      this.save.coins += mission.reward; this.save.totalCoins += mission.reward;
      saveProgress(this.save);
      this.ui.toast(`MISSION COMPLETE  +${mission.reward}`, 'purple'); this.audio.event('complete'); this.ui.renderMissions();
    }
  }

  updateHudThrottled() { this.ui.updateHud(this.hudData()); }

  hudData() {
    const mission = this.runMission || { title: 'Reach the next ridge', target: 1500, type: 'distance' };
    const value = mission.type === 'distance' ? this.distance : mission.type === 'coins' ? this.runCoinPickups : this.runFlips;
    return {
      distance: this.distance, score: this.score, fuel: this.fuel, gravityEnergy: this.gravityEnergy, nitro: this.player.nitro || 0,
      worldLabel: this.terrain.themeAt(this.player.x).label, missionText: mission.title.toUpperCase(), missionProgress: clamp(value / mission.target * 100, 0, 100),
      combo: this.combo, status: this.rewinding ? 'REWIND // FINDING A BETTER LINE' : this.player.healthState !== 'NORMAL' ? `DAMAGE // ${this.player.healthState}` : this.status,
      gravityMode: this.gravityMode, gravityPulse: this.gravityPulse
    };
  }

  updateCamera(dt) {
    const lookAhead = clamp(this.player.vx * .25, -80, 180);
    const targetX = Math.max(0, this.player.x - this.renderer.width * .31 + lookAhead);
    const targetY = this.player.y - this.renderer.height * .58;
    const follow = 1 - Math.pow(.001, dt);
    this.camera.x = lerp(this.camera.x, targetX, follow);
    this.camera.y = lerp(this.camera.y, targetY, follow * .78);
    if (this.camera.y > 50) this.camera.y = 50;
  }

  captureSnapshot(dt) {
    this.snapshotTimer += dt;
    if (this.snapshotTimer < .11) return;
    this.snapshotTimer = 0;
    this.snapshots.push({ player: this.player.getState(), fuel: this.fuel, gravityEnergy: this.gravityEnergy, gravityMode: this.gravityMode, gravityTimer: this.gravityTimer, nitro: this.player.nitro, score: this.score, runCoins: this.runCoins, runCoinPickups: this.runCoinPickups, runFlips: this.runFlips, combo: this.combo, bestComboRun: this.bestComboRun, collected: [...this.collected] });
    if (this.snapshots.length > 110) this.snapshots.shift();
  }

  startRewind() {
    if (this.rewinding || this.snapshots.length < 4 || this.gravityEnergy < 18 || this.finished) return;
    this.rewinding = true; this.rewindCursor = this.snapshots.length - 1; this.rewindTimer = 2.45; this.gravityEnergy -= 18; this.audio.event('rewind'); this.flash = .45; this.flashColor = '#9e7bff'; this.camera.shake = 8;
    this.ui.toast('REWIND // 2.4 SEC', 'purple');
  }

  updateRewind(dt) {
    this.rewindTimer -= dt;
    this.rewindCursor -= dt * 10.5;
    const snap = this.snapshots[Math.max(0, Math.floor(this.rewindCursor))];
    if (snap) this.restoreSnapshot(snap);
    this.status = 'REWIND // FINDING A BETTER LINE';
    this.updateCamera(dt * 1.8);
    if (this.rewindTimer <= 0 || this.rewindCursor <= 0) {
      this.rewinding = false; this.status = 'SECTOR 01 // DRIVE'; this.snapshots = this.snapshots.slice(0, Math.max(1, Math.floor(this.rewindCursor) + 1));
      this.flash = .22; this.flashColor = '#d8c5ff'; this.particles.burst(this.player.x, this.player.y, 'gravity', .8);
    }
    this.ui.updateHud(this.hudData());
  }

  restoreSnapshot(snapshot) {
    this.player.restore(snapshot.player); this.fuel = snapshot.fuel; this.gravityEnergy = snapshot.gravityEnergy; this.gravityMode = snapshot.gravityMode; this.gravityTimer = snapshot.gravityTimer; this.player.nitro = snapshot.nitro; this.score = snapshot.score; this.runCoins = snapshot.runCoins; this.runCoinPickups = snapshot.runCoinPickups ?? this.runCoins / 10; this.runFlips = snapshot.runFlips; this.combo = snapshot.combo; this.bestComboRun = snapshot.bestComboRun; this.collected = new Set(snapshot.collected);
  }

  activateGravity() {
    if (this.gravityCooldown > 0 || this.gravityEnergy < 20 || this.rewinding) { this.ui.toast(this.gravityCooldown > 0 ? 'CORE COOLING' : 'CORE EMPTY', 'purple'); return; }
    const next = this.gravityMode === 'normal' ? 'low' : this.gravityMode === 'low' ? 'reverse' : 'normal';
    this.setGravity(next, false);
  }

  setGravity(mode, automatic) {
    this.gravityMode = mode;
    this.gravityTimer = mode === 'normal' ? 0 : mode === 'low' ? 5.8 : 4.2;
    this.gravityCooldown = automatic ? .8 : 1.1;
    this.gravityPulse = 1.2; this.flash = .28; this.flashColor = mode === 'reverse' ? '#ff6e99' : '#bd8aff'; this.camera.shake = Math.max(this.camera.shake, 7);
    this.audio.event('gravity'); this.particles.burst(this.player.x, this.player.y, 'gravity', 1.7);
    this.status = mode === 'reverse' ? 'GRAVITY // UPWARD VECTOR' : mode === 'low' ? 'GRAVITY // LOW FIELD' : 'SECTOR 01 // DRIVE';
    this.ui.toast(mode === 'reverse' ? 'REVERSE GRAVITY' : mode === 'low' ? 'LOW GRAVITY' : 'NORMAL GRAVITY', 'purple');
  }

  addFloater(text, x, y, color) { this.floatingTexts.push({ text, x, y, color, life: 1, maxLife: 1 }); }
  updateFloaters(dt) { for (let i = this.floatingTexts.length - 1; i >= 0; i -= 1) { const f = this.floatingTexts[i]; f.life -= dt; f.y += 28 * dt; if (f.life <= 0) this.floatingTexts.splice(i,1); } }

  togglePause() {
    if (!this.active || this.finished) return;
    this.paused = !this.paused; this.input.clear(); this.ui.setPause(this.paused); this.audio.stopEngine(); if (this.paused) this.status = 'RUN PAUSED // TELEMETRY HOLD'; else this.status = 'SECTOR 01 // DRIVE';
  }

  finishRun(complete = false, reason = 'RUN TERMINATED', subtitle = '') {
    if (this.finished) return;
    this.finished = true; this.paused = false; this.rewinding = false; this.audio.stopEngine(); this.audio.event(complete ? 'complete' : 'gameover');
    if (!complete) { this.particles.burst(this.player.x, this.player.y, 'spark', 2); this.particles.emit(this.player.x, this.player.y + 20, 'smoke', 20, { speed: 25, gravity: 10, life: 1.4, size: 6 }); this.camera.shake = 15; }
    const distance = this.distance;
    const newRecord = distance > this.save.bestDistance;
    this.save.coins += this.runCoins; this.save.totalCoins += this.runCoins;
    this.save.bestDistance = Math.max(this.save.bestDistance, distance); this.save.bestScore = Math.max(this.save.bestScore, this.score); this.save.bestCombo = Math.max(this.save.bestCombo, this.bestComboRun); this.save.bestStunt = Math.max(this.save.bestStunt, this.bestStuntRun);
    this.ui.save = this.save;
    this.ui.refreshAll();
    this.ui.showResults({ complete, reason, subtitle, distance, score: this.score, coins: this.runCoins, bestCombo: this.bestComboRun, newRecord });
  }

  get distance() { return Math.max(0, (this.player.x - 160) / 4); }

  handleUiAction(action) {
    if (action === 'play') this.start(this.ui.mode);
    else if (action === 'pause') this.togglePause();
    else if (action === 'resume') { this.paused = false; this.ui.setPause(false); }
    else if (action === 'restart') this.start(this.mode);
    else if (action === 'gravity') this.input.press('gravity');
    else if (action === 'rewind') this.input.press('rewind');
  }

  leaveRun() {
    if (!this.active) return;
    this.active = false; this.paused = false; this.finished = false; this.rewinding = false; this.input.clear(); this.audio.stopEngine(); this.ui.setInRun(false); this.ui.setPause(false); this.ui.refs.gameOverOverlay.classList.remove('active');
  }

  onRoute(route) {
    if (route !== 'menu' && route !== 'game') this.leaveRun();
    if (route === 'menu') this.leaveRun();
  }
}
