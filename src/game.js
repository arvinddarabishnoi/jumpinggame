/* game.js — the game itself: loop, states, camera, HUD and juice
 * ------------------------------------------------------------------
 * Internal resolution is 320x180 (16:9, every sprite 1:1) and the canvas is
 * scaled up by whole numbers, so the pixels stay crisp on any screen.
 */

import { loadAll, draw } from './loader.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { LEVELS, Tilemap, TILE, T, drawBackground } from './levels.js';
import { Hero, Slime, Bat, Pickup, Particles, PHYS, clamp, rnd } from './entities.js';

const VIEW_W = 320, VIEW_H = 180;
const STEP = 1 / 60;

/* ---------------------------------------------------------- 3x5 pixel font */
const g = (...r) => r.join('');
const FONT = {
  A: g('.#.', '#.#', '###', '#.#', '#.#'), B: g('##.', '#.#', '##.', '#.#', '##.'),
  C: g('.##', '#..', '#..', '#..', '.##'), D: g('##.', '#.#', '#.#', '#.#', '##.'),
  E: g('###', '#..', '##.', '#..', '###'), F: g('###', '#..', '##.', '#..', '#..'),
  G: g('.##', '#..', '#.#', '#.#', '.##'), H: g('#.#', '#.#', '###', '#.#', '#.#'),
  I: g('###', '.#.', '.#.', '.#.', '###'), J: g('..#', '..#', '..#', '#.#', '.#.'),
  K: g('#.#', '#.#', '##.', '#.#', '#.#'), L: g('#..', '#..', '#..', '#..', '###'),
  M: g('#.#', '###', '###', '#.#', '#.#'), N: g('#.#', '###', '###', '###', '#.#'),
  O: g('.#.', '#.#', '#.#', '#.#', '.#.'), P: g('##.', '#.#', '##.', '#..', '#..'),
  Q: g('.#.', '#.#', '#.#', '###', '.##'), R: g('##.', '#.#', '##.', '#.#', '#.#'),
  S: g('.##', '#..', '.#.', '..#', '##.'), T: g('###', '.#.', '.#.', '.#.', '.#.'),
  U: g('#.#', '#.#', '#.#', '#.#', '.##'), V: g('#.#', '#.#', '#.#', '#.#', '.#.'),
  W: g('#.#', '#.#', '###', '###', '#.#'), X: g('#.#', '#.#', '.#.', '#.#', '#.#'),
  Y: g('#.#', '#.#', '.#.', '.#.', '.#.'), Z: g('###', '..#', '.#.', '#..', '###'),
  0: g('###', '#.#', '#.#', '#.#', '###'), 1: g('.#.', '##.', '.#.', '.#.', '###'),
  2: g('##.', '..#', '.#.', '#..', '###'), 3: g('##.', '..#', '.##', '..#', '##.'),
  4: g('#.#', '#.#', '###', '..#', '..#'), 5: g('###', '#..', '##.', '..#', '##.'),
  6: g('.##', '#..', '##.', '#.#', '.#.'), 7: g('###', '..#', '.#.', '.#.', '.#.'),
  8: g('.#.', '#.#', '.#.', '#.#', '.#.'), 9: g('.#.', '#.#', '.##', '..#', '##.'),
  ' ': g('...', '...', '...', '...', '...'),
  '.': g('...', '...', '...', '...', '.#.'), ',': g('...', '...', '...', '.#.', '#..'),
  ':': g('...', '.#.', '...', '.#.', '...'), '!': g('.#.', '.#.', '.#.', '...', '.#.'),
  '?': g('##.', '..#', '.#.', '...', '.#.'), '-': g('...', '...', '###', '...', '...'),
  '+': g('...', '.#.', '###', '.#.', '...'), '/': g('..#', '..#', '.#.', '#..', '#..'),
  "'": g('.#.', '.#.', '...', '...', '...'), '(': g('.#.', '#..', '#..', '#..', '.#.'),
  ')': g('.#.', '..#', '..#', '..#', '.#.'), '<': g('..#', '.#.', '#..', '.#.', '..#'),
  '>': g('#..', '.#.', '..#', '.#.', '#..'), '*': g('#.#', '.#.', '###', '.#.', '#.#'),
  '=': g('...', '###', '...', '###', '...'), '%': g('#.#', '..#', '.#.', '#..', '#.#'),
};

function textWidth(s, sc = 1) { return s.length * 4 * sc - sc; }

function drawText(c, str, x, y, col = '#fff6d8', sc = 1, shadow = '#241a2e') {
  str = String(str).toUpperCase();
  x = Math.round(x); y = Math.round(y);          // half-pixel text looks broken
  if (shadow) {
    for (let i = 0; i < str.length; i++) glyph(c, str[i], x + i * 4 * sc + sc, y + sc, shadow, sc);
  }
  for (let i = 0; i < str.length; i++) glyph(c, str[i], x + i * 4 * sc, y, col, sc);
}
function glyph(c, ch, x, y, col, sc) {
  const f = FONT[ch] || FONT['?'];
  c.fillStyle = col;
  for (let r = 0; r < 5; r++)
    for (let q = 0; q < 3; q++)
      if (f[r * 3 + q] === '#') c.fillRect(x + q * sc, y + r * sc, sc, sc);
}
const HEART_ICON = ['.#.#.#.', '#######', '#######', '.#####.', '..###..', '...#...'];
function drawHeart(c, x, y, col) {
  c.fillStyle = col;
  HEART_ICON.forEach((row, r) => {
    for (let q = 0; q < row.length; q++) if (row[q] === '#') c.fillRect(x + q, y + r, 1, 1);
  });
}

/* ------------------------------------------------------------------ game */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d', { alpha: false });
    this.c.imageSmoothingEnabled = false;
    this.input = new Input();
    this.audio = new Audio();
    this.particles = new Particles();
    this.time = 0;
    this.acc = 0;
    this.state = 'boot';           // boot | title | play | paused | dead | clear | win
    this.levelIndex = 0;
    this.score = 0;
    this.best = +(localStorage.getItem('emberknight.best') || 0);
    this.unlocked = +(localStorage.getItem('emberknight.unlocked') || 1);
    this.shakeAmt = 0; this.shakeTime = 0;
    this.freeze = 0;
    this.flashMsg = null;
    this.stateTime = 0;
    this.debug = false;
    this.fps = 0; this._fpsT = 0; this._fpsN = 0;
    this.prevVy = 0;
    this.sheets = null;
    this.hintTime = 0;
    this.bannerT = 0;
  }

  /* ---------------------------------------------------------------- boot */
  async boot() {
    const bar = document.getElementById('bootbar');
    const msg = document.getElementById('bootmsg');
    try {
      this.sheets = await loadAll(p => { bar.style.width = Math.round(p * 100) + '%'; });
    } catch (e) {
      msg.textContent = 'asset error: ' + e.message;
      console.error(e);
      return;
    }
    msg.textContent = 'ready!';
    document.getElementById('boot').classList.add('gone');
    this.state = 'title';
    this.stateTime = 0;
    this.titleHero = new Hero(0, 0);
    requestAnimationFrame(t => this.frame(t));
  }

  /* -------------------------------------------------------------- levels */
  startLevel(i) {
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    const L = LEVELS[this.levelIndex];
    this.tilemap = new Tilemap(L, this.sheets);
    this.hero = new Hero((L.spawn.x + 0.5) * TILE, (L.spawn.y + 1) * TILE);
    this.enemies = [];
    for (const e of L.enemies || []) {
      const x = (e.x + 0.5) * TILE;
      const y = e.y !== undefined ? (e.y + 1) * TILE : (L.groundRow) * TILE;
      this.enemies.push(e.type === 'bat' ? new Bat(x, y) : new Slime(x, y));
    }
    this.pickups = [];
    for (const cv of L.coins || []) {
      for (let k = 0; k < cv.n; k++) {
        const x = (cv.x + k * cv.step + 0.5) * TILE;
        const y = cv.kind === 'arc'
          ? (cv.y + 1) * TILE - Math.sin((k / Math.max(1, cv.n - 1)) * Math.PI) * cv.h * TILE
          : (cv.y + 1) * TILE;
        this.pickups.push(new Pickup(x, y, 'coin'));
      }
    }
    for (const h of L.hearts || []) this.pickups.push(new Pickup((h.x + 0.5) * TILE, (h.y + 1) * TILE, 'heart'));
    for (const p of L.potions || []) this.pickups.push(new Pickup((p.x + 0.5) * TILE, (p.y + 1) * TILE, 'potion'));
    this.particles.list.length = 0;
    this.cam = { x: 0, y: 0 };
    this.cam.x = clamp(this.hero.x - VIEW_W / 2, 0, L.w * TILE - VIEW_W);
    this.cam.y = clamp(this.hero.y - VIEW_H * 0.6, 0, L.h * TILE - VIEW_H);
    this.hintTime = 5.5;
    this.bannerT = 2.6;
    this.goalT = 0;
    this.coinsAtStart = 0;
    this.scoreAtStart = this.score;
    this.state = 'play';
    this.stateTime = 0;
  }

  /* ------------------------------------------------------------ fx hooks */
  shake(amt, t = 0.2) { this.shakeAmt = Math.max(this.shakeAmt, amt); this.shakeTime = Math.max(this.shakeTime, t); }
  hitstop(t) { this.freeze = Math.max(this.freeze, t); }
  spark(x, y, n, col) { this.particles.spark(x, y, n, col); }
  dust(x, y, n, spread) { this.particles.dust(x, y, n, spread); }
  burst(x, y, n, col) { this.particles.burst(x, y, n, col); }
  ring(x, y) { this.particles.ring(x, y); }
  flash(msg) { this.flashMsg = { msg, t: 1.1 }; }

  hurtPlayerIfTouching(rect, dmg, fromX, source) {
    const h = this.hero;
    if (h.state === 'death' || h.invuln > 0) return;
    if (!h.overlapsRect(rect)) return;
    // stomping: falling onto a slime hurts the slime, not you
    if (source && source.takeHit && h.vy > 1.2 && h.bottom - h.vy <= rect.y + 4) {
      if (source.takeHit(1, h.x, this, 0)) h.vy = PHYS.STOMP_V;
      return;
    }
    if (h.hurt(dmg, fromX, this)) this.score = Math.max(0, this.score - 25);
  }

  /** sword swing: hit every enemy the rect touches (once per swing) */
  hitEnemies(rect, dmg, dir, hero) {
    let any = false;
    for (const e of this.enemies) {
      if (e.state === 'death') continue;
      if (e.overlapsRect(rect)) {
        if (e.takeHit(e.maxHp > 1 ? dmg : 99, hero.x, this, dir)) any = true;
      }
    }
    if (any) this.hitstop(0.06);
    return any;
  }

  /* -------------------------------------------------------------- update */
  step(dt) {
    this.dt = dt;                       // entities read world.dt
    this.time += dt;
    this.stateTime += dt;
    const input = this.input;

    if (this.state === 'title') {
      if (input.confirmPressed()) {
        this.audio.unlock(); this.audio.menu();
        this.score = 0;
        this.startLevel(0);
      }
      const lv = input.pressedLevel();
      if (lv >= 0 && lv <= this.unlocked) { this.audio.unlock(); this.startLevel(lv); }
      this.titleHero.animate({ dt });
      this.particles.update(dt);
      return;
    }

    if (this.state === 'play') {
      if (input.justPressed('pause')) { this.state = 'paused'; this.audio.menu(); return; }
      if (input.justPressed('mute')) { const m = this.audio.toggleMute(); this.flash(m ? 'SOUND OFF' : 'SOUND ON'); }
      if (input.justPressed('restart')) { this.startLevel(this.levelIndex); return; }
      if (input.justPressed('debug')) this.debug = !this.debug;

      this.hero.update(this);
      for (const e of this.enemies) e.update(this);
      for (const p of this.pickups) p.update(this);
      this.enemies = this.enemies.filter(e => !e.remove);
      this.pickups = this.pickups.filter(p => !p.remove);
      this.particles.update(dt);

      // goal?
      const L = LEVELS[this.levelIndex];
      if (this.hero.x > L.goal * TILE && this.hero.state !== 'death') {
        this.state = 'clear';
        this.audio.win();
        this.burst(this.hero.x, this.hero.cy, 26, '#ffd76a');
        this.shake(2, 0.3);
        const next = Math.min(LEVELS.length, this.levelIndex + 2);
        if (next > this.unlocked) { this.unlocked = next; localStorage.setItem('emberknight.unlocked', this.unlocked); }
      }
      if (this.hero.dead) {
        this.state = 'dead';
        this.stateTime = 0;
        if (this.score > this.best) { this.best = this.score; localStorage.setItem('emberknight.best', this.best); }
      }
      this.updateCamera(dt);
      if (this.flashMsg) { this.flashMsg.t -= dt; if (this.flashMsg.t <= 0) this.flashMsg = null; }
      this.hintTime = Math.max(0, this.hintTime - dt);
      this.bannerT = Math.max(0, this.bannerT - dt);
      return;
    }

    if (this.state === 'paused') {
      if (input.justPressed('pause') || input.confirmPressed()) { this.state = 'play'; this.audio.menu(); }
      if (input.justPressed('restart')) this.startLevel(this.levelIndex);
      return;
    }

    if (this.state === 'dead') {
      this.particles.update(dt);
      if (this.stateTime > 0.8 && (input.confirmPressed() || input.justPressed('restart'))) {
        this.startLevel(this.levelIndex);
      }
      return;
    }

    if (this.state === 'clear') {
      this.particles.update(dt);
      if (this.stateTime > 0.7 && input.confirmPressed()) {
        if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
        else {
          this.state = 'win'; this.stateTime = 0;
          if (this.score > this.best) { this.best = this.score; localStorage.setItem('emberknight.best', this.best); }
        }
      }
      return;
    }

    if (this.state === 'win') {
      this.particles.update(dt);
      if (this.stateTime > 0.6 && input.confirmPressed()) { this.state = 'title'; this.stateTime = 0; }
      return;
    }
  }

  updateCamera(dt) {
    const L = LEVELS[this.levelIndex];
    const h = this.hero;
    const lead = clamp(h.vx * 16, -40, 40);       // look ahead in the run direction
    const tx = clamp(h.x + lead - VIEW_W / 2, 0, L.w * TILE - VIEW_W);
    // when falling, ease the camera back so we don't rush to the bottom
    const ty = clamp(h.y - VIEW_H * 0.62 - (h.onGround ? 0 : 10) - Math.min(0, h.vy) * 3.2,
                     0, L.h * TILE - VIEW_H);
    const k = 1 - Math.pow(0.0009, dt);
    this.cam.x += (tx - this.cam.x) * Math.min(1, k * 1.35);
    this.cam.y += (ty - this.cam.y) * Math.min(1, k);
  }

  /* -------------------------------------------------------------- render */
  render() {
    const c = this.c;
    c.save();
    c.imageSmoothingEnabled = false;
    if (!this.sheets) { c.restore(); return; }

    if (this.state === 'title') {
      drawBackground(c, this.sheets, { x: this.time * 8, y: 0 }, LEVELS[0], this.time);
      this.renderTitle(c);
      c.restore();
      return;
    }

    // screen shake
    let sx = 0, sy = 0;
    if (this.shakeTime > 0) {
      const k = this.shakeAmt * (this.shakeTime / 0.25);
      sx = rnd(-k, k); sy = rnd(-k, k);
      this.shakeAmt *= 0.9;
      this.shakeTime -= STEP;
    }

    const L = LEVELS[this.levelIndex];
    drawBackground(c, this.sheets, this.cam, L, this.time);   // screen space!
    c.translate(Math.round(-this.cam.x + sx), Math.round(-this.cam.y + sy));

    // baked terrain + props
    c.drawImage(this.tilemap.canvas, 0, 0);

    for (const p of this.pickups) p.render(c, this.sheets, this.time);
    for (const e of this.enemies) e.render(c, this.sheets, this.time);
    this.hero.render(c, this.sheets, this.time);
    this.particles.render(c);

    // attack trail highlight (the sprite has its own crescent; this is a
    // soft speed-line that only shows on the active frames)
    if (this.hero.attackActive) {
      const r = this.hero.attackRect();
      c.globalAlpha = 0.20;
      c.fillStyle = '#fff6cf';
      c.fillRect(Math.round(r.x), Math.round(r.y), r.w, r.h);
      c.globalAlpha = 1;
    }

    if (this.debug) this.renderDebug(c);

    c.restore();

    // ---- HUD (screen space)
    this.renderHud(c);

    // death / clear / pause overlays
    if (this.state === 'dead') this.renderCenterPanel(c, 'GAME OVER',
      [`SCORE ${this.score}`, `BEST ${Math.max(this.best, this.score)}`, '', 'SPACE / TAP TO RETRY'], '#ff9a9a');
    if (this.state === 'clear') this.renderCenterPanel(c, 'LEVEL CLEAR',
      [`${LEVELS[this.levelIndex].name.toUpperCase()}`, `COINS ${this.hero.coins}   SCORE ${this.score}`, '',
       this.levelIndex + 1 < LEVELS.length ? 'SPACE / TAP FOR NEXT LEVEL' : 'SPACE / TAP TO FINISH'], '#b6f3c0');
    if (this.state === 'win') this.renderCenterPanel(c, 'YOU WIN',
      ['THE EMBER KNIGHT RESTORES THE LIGHT', `FINAL SCORE ${this.score}`, `BEST ${this.best}`, '',
       'SPACE / TAP FOR THE TITLE'], '#ffd76a');
    if (this.state === 'paused') this.renderCenterPanel(c, 'PAUSED',
      ['SPACE RESUME', 'R RESTART LEVEL', 'M SOUND', 'ESC RESUME'], '#cfe6ff');
  }

  renderTitle(c) {
    const W = VIEW_W, H = VIEW_H;
    c.fillStyle = 'rgba(20,16,36,0.45)';
    c.fillRect(0, 0, W, H);
    // hero idling on a little mound
    const y = H - 34;
    for (let x = 0; x < W; x += 16) {
      c.drawImage(this.sheets.tiles.image, this.sheets.tiles.anims['dirt'].frames[0][0], 0, 16, 16,
                  x, y + 16, 16, 16);
      c.drawImage(this.sheets.tiles.image, this.sheets.tiles.anims['ground_top'].frames[0][0], 0, 16, 16,
                  x, y, 16, 16);
    }
    const bob = Math.sin(this.time * 2) * 0.6;
    draw(c, this.sheets.hero.get('idle'), this.time, 58, y + 4 + bob, {});
    // title
    const t = 'EMBER KNIGHT';
    drawText(c, t, (W - textWidth(t, 2)) / 2, 26, '#ffd76a', 2);
    const s = 'A JUMPING GAME';
    drawText(c, s, (W - textWidth(s)) / 2, 44, '#fff6d8', 1);
    if (Math.floor(this.time * 2) % 2 === 0) {
      const p = 'PRESS SPACE OR TAP TO START';
      drawText(c, p, (W - textWidth(p)) / 2, H - 58, '#ffffff', 1);
    }
    const ctl = 'ARROWS / AD MOVE   SPACE JUMP (X2)   X SWORD   P PAUSE   M SOUND';
    drawText(c, ctl, (W - textWidth(ctl)) / 2, H - 18, '#cbb8ff', 1);
    const bs = `BEST ${this.best}`;
    drawText(c, bs, 6, 6, '#fff6d8', 1);
    if (this.unlocked > 1) {
      const u = `PRESS 1-${this.unlocked} FOR A LEVEL`;
      drawText(c, u, (W - textWidth(u)) / 2, H - 34, '#9fe0c0', 1);
    }
  }

  renderHud(c) {
    const h = this.hero;
    if (!h) return;
    // hearts
    c.fillStyle = 'rgba(20,16,36,0.55)';
    c.fillRect(3, 3, 8 + h.maxHp * 9, 12);
    for (let i = 0; i < h.maxHp; i++) {
      const filled = i < h.hp;
      drawHeart(c, 7 + i * 9, 6, filled ? '#ef4757' : '#4a3f63');
      if (filled) drawHeart(c, 7 + i * 9, 5, '#ff8b93');
    }
    // coins + score
    const tile = this.sheets.tiles;
    const coin = tile.anims.coin0.frames[0];
    c.drawImage(tile.image, coin[0], coin[1], 16, 16, 6, 17, 10, 10);
    drawText(c, `${h.coins}`, 19, 19, '#ffe27a', 1);
    const sc = `SCORE ${this.score}`;
    drawText(c, sc, VIEW_W - textWidth(sc) - 5, 5, '#fff6d8', 1);
    const name = LEVELS[this.levelIndex].name.toUpperCase();
    drawText(c, name, VIEW_W - textWidth(name) - 5, 17, '#cbb8ff', 1);

    // level hint tape at the start
    if (this.hintTime > 0) {
      const a = Math.min(1, this.hintTime / 0.8);
      c.globalAlpha = a;
      const msg = LEVELS[this.levelIndex].hint;
      c.fillStyle = 'rgba(20,16,36,0.62)';
      c.fillRect(0, VIEW_H - 17, VIEW_W, 17);
      drawText(c, msg, (VIEW_W - textWidth(msg)) / 2, VIEW_H - 13, '#fff6d8', 1);
      c.globalAlpha = 1;
    }
    // banner at the start of the level
    if (this.bannerT > 0) {
      const a = Math.min(1, this.bannerT / 0.6);
      const msg = LEVELS[this.levelIndex].name.toUpperCase();
      c.globalAlpha = a * 0.9;
      c.fillStyle = 'rgba(20,16,36,0.35)';
      c.fillRect(0, 44, VIEW_W, 22);
      drawText(c, msg, (VIEW_W - textWidth(msg, 2)) / 2, 47, '#ffd76a', 2);
      c.globalAlpha = 1;
    }
    if (this.flashMsg) {
      const m = this.flashMsg.msg.toUpperCase();
      c.globalAlpha = Math.min(1, this.flashMsg.t / 0.5);
      drawText(c, m, (VIEW_W - textWidth(m)) / 2, 96, '#b6f3c0', 1);
      c.globalAlpha = 1;
    }
    // low health warning
    if (h.hp === 1 && this.state === 'play' && Math.floor(this.time * 3) % 2 === 0) {
      const w = 'LOW HEALTH';
      drawText(c, w, (VIEW_W - textWidth(w)) / 2, VIEW_H - 14, '#ff8b93', 1);
    }
    if (this.debug) {
      const d = `FPS ${this.fps.toFixed(0)}  ENEMIES ${this.enemies.length}  STATE ${this.hero.state}`;
      drawText(c, d, 4, VIEW_H - 10, '#9fe0c0', 1);
    }
  }

  renderCenterPanel(c, title, lines, col) {
    const W = VIEW_W;
    c.fillStyle = 'rgba(16,12,30,0.68)';
    c.fillRect(0, 0, W, VIEW_H);
    const tw = textWidth(title, 2);
    drawText(c, title, (W - tw) / 2, 44, col, 2);
    lines.forEach((l, i) => {
      if (!l) return;
      const w = textWidth(l, 1);
      drawText(c, l, (W - w) / 2, 74 + i * 12, '#fff6d8', 1);
    });
  }

  renderDebug(c) {
    c.strokeStyle = '#ff5ac8';
    c.lineWidth = 1;
    const boxes = [this.hero.rect(), ...this.enemies.map(e => e.rect())];
    for (const b of boxes) c.strokeRect(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5, b.w - 1, b.h - 1);
    if (this.hero.attackActive) {
      const r = this.hero.attackRect();
      c.strokeStyle = '#ffe27a';
      c.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, r.w - 1, r.h - 1);
    }
  }

  /* ---------------------------------------------------------------- loop */
  frame(t) {
    const now = t / 1000;
    const raw = Math.min(0.1, now - (this.last || now));
    this.last = now;
    this._fpsT += raw; this._fpsN++;
    if (this._fpsT > 0.5) { this.fps = this._fpsN / this._fpsT; this._fpsT = 0; this._fpsN = 0; }

    if (this.freeze > 0) {
      this.freeze -= raw;
    } else {
      this.acc += raw;
      let steps = 0;
      while (this.acc >= STEP && steps < 6) {
        this.step(STEP);
        this.input.update(STEP);
        this.acc -= STEP;
        steps++;
      }
      if (steps === 6) this.acc = 0;
    }
    this.audio.music(raw);
    this.render();
    requestAnimationFrame(tt => this.frame(tt));
  }
}

/* --------------------------------------------------------------- bootstrap */
function fitStage() {
  const stage = document.getElementById('stage');
  const s = Math.max(1, Math.min(Math.floor(window.innerWidth / VIEW_W),
                                 Math.floor(window.innerHeight / VIEW_H)));
  stage.style.width = VIEW_W * s + 'px';
  stage.style.height = VIEW_H * s + 'px';
}
window.addEventListener('resize', fitStage);
fitStage();

const game = new Game(document.getElementById('game'));
game.boot();
window.game = game;                    // handy for tinkering in the console
