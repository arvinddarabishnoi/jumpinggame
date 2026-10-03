/* tools/headless.mjs — run the game inside Node with a fake DOM + canvas.
 *
 * There is no browser needed: every canvas call is recorded, so the game's
 * logic can be exercised (and screenshotted) from the command line:
 *
 *   node tools/headless.mjs --seconds 20 --shot 6,10,14 --out /tmp/game
 *
 * then render the recorded frames with:
 *   python3 tools/replay.py /tmp/game/title.json /tmp/game/shot6.json ...
 *
 * Options:
 *   --seconds N     how long to simulate (default 12)
 *   --shot a,b,c    take a screenshot at these times (seconds)
 *   --bot           0 = stand still, 1 = run right + jump + swing (default 1)
 *   --level N       start on this level (1-3)
 *   --out DIR       where the JSON frame dumps go (default /tmp/frames)
 *   --quiet         only print the summary
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : def;
};
const SECONDS = +(opt('seconds', 12));
const OUT = String(opt('out', '/tmp/frames'));
const SHOTS = String(opt('shot', '')).split(',').filter(Boolean).map(Number);
const BOT = +(opt('bot', 1));
const LEVEL = +(opt('level', 1));
const QUIET = !!opt('quiet', false);
const KILLAT = +(opt('killat', -1));
const GOTO = +(opt('goto', -1));
const NOENEMY = !!opt('noenemies', false);
const GODMODE = !!opt('god', false);
const LOG = (...a) => { if (!QUIET) console.log(...a); };

fs.mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------- image + canvas */
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

class FakeImage {
  constructor() { this.width = 0; this.height = 0; this._src = ''; }
  set src(v) {
    this._src = v;
    const f = path.join(ROOT, v);
    try {
      const s = pngSize(f);
      this.width = s.width; this.height = s.height;
      this.ok = true;
    } catch (e) { this.ok = false; }
    if (this.onload) this.onload();
  }
  get src() { return this._src; }
  get name() { return this._src.split('/').pop(); }
}

/** a 2D context that records every call instead of painting */
function makeContext(canvas, name) {
  const ops = [];
  let m = [1, 0, 0, 1, 0, 0];              // a b c d e f
  const stack = [];
  const mul = (n) => {
    m = [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
         m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
         m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  };
  const ctx = {
    canvas,
    ops,
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '8px monospace',
    textAlign: 'left',
    textBaseline: 'top',
    save() { stack.push({ m: m.slice(), a: this.globalAlpha, f: this.fillStyle }); ops.push({ op: 'save' }); },
    restore() {
      const s = stack.pop();
      if (s) { m = s.m; this.globalAlpha = s.a; this.fillStyle = s.f; }
      ops.push({ op: 'restore' });
    },
    translate(x, y) { mul([1, 0, 0, 1, x, y]); ops.push({ op: 'translate', x, y }); },
    scale(x, y) { mul([x, 0, 0, y, 0, 0]); ops.push({ op: 'scale', x, y }); },
    rotate() { ops.push({ op: 'rotate' }); },
    fillRect(x, y, w, h) {
      ops.push({ op: 'fillRect', m: m.slice(), x, y, w, h, col: this.fillStyle, alpha: this.globalAlpha });
    },
    clearRect() {},
    strokeRect(x, y, w, h) {
      ops.push({ op: 'strokeRect', m: m.slice(), x, y, w, h, col: this.strokeStyle, alpha: this.globalAlpha });
    },
    fillText() {},
    drawImage(img, ...a) {
      let sx = 0, sy = 0, sw = 0, sh = 0, dx = 0, dy = 0, dw = 0, dh = 0;
      if (a.length === 2) { [dx, dy] = a; sw = img.width; sh = img.height; dw = sw; dh = sh; }
      else if (a.length === 4) { [dx, dy, dw, dh] = a; sw = img.width; sh = img.height; }
      else if (a.length === 6) { [sx, sy, sw, sh, dx, dy] = a; dw = sw; dh = sh; }
      else { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
      const isCanvas = !!img.__isCanvas;
      ops.push({
        op: 'drawImage', m: m.slice(), alpha: this.globalAlpha,
        src: isCanvas ? null : (img.name || 'unknown'),
        sub: isCanvas ? img.__ctx.ops : null,
        sx, sy, sw, sh, dx, dy, dw, dh,
        iw: img.width, ih: img.height,
      });
    },
    createLinearGradient(x0, y0, x1, y1) {
      const stops = [];
      const g = {
        addColorStop: (p, c) => stops.push([p, c]),
        __grad: { x0, y0, x1, y1, stops },
      };
      // fills using a gradient are recorded with the middle stop as the colour
      setTimeout(() => { }, 0);
      return g;
    },
  };
  // fillStyle may be set to a gradient object
  Object.defineProperty(ctx, 'fillStyle', {
    get() { return ctx._fill; },
    set(v) { ctx._fill = (v && v.__grad) ? v.__grad.stops[Math.floor(v.__grad.stops.length / 2)][1] : v; },
  });
  ctx._fill = '#000';
  return ctx;
}

function makeCanvas(name) {
  const cv = {
    width: 320, height: 180, __isCanvas: true, style: {}, dataset: {},
    getContext() { if (!this.__ctx) this.__ctx = makeContext(this, name); return this.__ctx; },
    addEventListener() {}, appendChild() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; },
    classList: { add() {}, remove() {}, toggle() {} },
  };
  return cv;
}

/* ------------------------------------------------------------ fake DOM */
const gameCanvas = makeCanvas('main');
const elements = {
  game: gameCanvas,
  stage: { style: {}, classList: { add() {}, remove() {} }, addEventListener() {}, removeEventListener() {} },
  boot: { classList: { add() {}, remove() {} }, addEventListener() {} },
  bootbar: { style: {} },
  bootmsg: { textContent: '' },
};
globalThis.document = {
  createElement: (tag) => tag === 'canvas' ? makeCanvas('offscreen') : { style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {}, dataset: {} },
  getElementById: (id) => elements[id] || makeCanvas(id),
  querySelectorAll: () => [],
  body: { classList: { add() {}, remove() {} } },
  addEventListener() {},
};
globalThis.window = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  AudioContext: undefined,
};
Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0, userAgent: 'node' }, configurable: true });
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
};
globalThis.requestAnimationFrame = () => 0;          // we drive the loop ourselves
globalThis.Image = FakeImage;
globalThis.fetch = async (url) => {
  const p = path.join(ROOT, url);
  const txt = fs.readFileSync(p, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(txt), text: async () => txt };
};

/* ------------------------------------------------------------ run it */
const errors = [];
process.on('uncaughtException', e => { errors.push(e); console.error('UNCAUGHT', e); });
process.on('unhandledRejection', e => { errors.push(e); console.error('UNHANDLED', e); });
await import(path.join(ROOT, 'src/game.js'));
const game = globalThis.game || globalThis.window.game;

const frames = [];
const realRender = game.render.bind(game);
game.render = function () {
  this.c.ops.length = 0;
  try { realRender(); } catch (e) { errors.push(e); throw e; }
  if (this.__capture) frames.push({ t: +this.time.toFixed(2), state: this.state, ops: JSON.parse(JSON.stringify(this.c.ops)) });
};

await game.boot();
if (game.state !== 'title') throw new Error('boot did not reach the title screen');
LOG('boot ok — assets:', Object.keys(game.sheets).join(', '));

const STEP = 1 / 60;
const input = game.input;
const key = (name, on) => { input.down[name] = !!on; };

// start the game (and jump straight to the requested level)
key('jump', true);
game.step(STEP); input.update(STEP); key('jump', false); input.update(STEP);
for (let i = 0; i < 20; i++) { game.step(STEP); input.update(STEP); }
if (LEVEL > 1) { game.audio.unlock?.(); game.startLevel(LEVEL - 1); }
if (game.state !== 'play') throw new Error('failed to enter play state: ' + game.state);

if (NOENEMY) game.enemies.length = 0;

const capture = (want) => {
  game.__capture = true;
  const json = JSON.stringify({ w: 320, h: 180, state: game.state, time: game.time, ops: game.c.ops });
  fs.writeFileSync(path.join(OUT, `shot${want}.json`), json);
  game.__capture = false;
  LOG(`  wrote ${OUT}/shot${want}.json  (state=${game.state})`);
};

// also grab a title screen before we start
// (the title was rendered during boot; re-render one frame to capture it)
game.state = 'title'; game.stateTime = 0;
game.__capture = true; game.render(); game.__capture = false;
fs.writeFileSync(path.join(OUT, 'title.json'),
  JSON.stringify({ w: 320, h: 180, state: 'title', ops: game.c.ops }));
LOG(`  wrote ${OUT}/title.json`);
game.startLevel(LEVEL - 1);

// --- optional jump trace --------------------------------------------------
if (opt('trace', false)) {
  const j = game.hero;
  j.x = 6 * 16; j.y = 13 * 16; j.vx = 2.5; j.vy = -8.05; j.onGround = false; j.state = 'jump';
  j.coyote = 0.1; game.input.down.jump = true;
  for (let k = 0; k < 22; k++) {
    j.update(game);
    console.log(`k=${String(k).padStart(2)} y=${j.y.toFixed(1)} vy=${j.vy.toFixed(2)} vx=${j.vx.toFixed(2)} ground=${j.onGround ? 1 : 0} state=${j.state}`);
    game.input.update(STEP);
  }
}

// --- optional: measure the jump arc on flat ground (physics tuning) --------
if (opt('measure', false)) {
  const j = game.hero;
  const test = (label, vy0, double) => {
    j.x = 4 * 16; j.y = 13 * 16; j.vx = 0; j.vy = 0; j.onGround = true;
    j.state = 'idle'; j.airJumps = 1;
    game.input.down = {}; game.input.was = {};
    game.input.down.right = true;
    for (let k = 0; k < 200 && j.vx < 2.6; k++) { j.update(game); game.input.update(STEP); }
    const speed = j.vx, x0 = j.x;
    j.vy = vy0; j.state = 'jump'; j.onGround = false; j.coyote = 0.1; j.airJumps = 1;
    game.input.down.jump = true;                 // hold = full height
    let peak = j.y, used = false, steps = 0;
    for (let k = 0; k < 200; k++) {
      if (double && !used && j.vy > 0.5) { j.vy = -7.4; used = true; }
      j.update(game); game.input.update(STEP);
      peak = Math.min(peak, j.y); steps++;
      if (j.onGround) break;
    }
    console.log(`${label}: distance ${(j.x - x0).toFixed(0)}px = ${((j.x - x0) / 16).toFixed(1)} tiles | ` +
                `height ${((13 * 16) - peak).toFixed(0)}px = ${(((13 * 16) - peak) / 16).toFixed(1)} tiles | ` +
                `airtime ${(steps / 60).toFixed(2)}s | top speed ${speed.toFixed(2)}px/step`);
  };
  test('run + single jump', -8.40, false);
  test('run + double jump', -8.40, true);
  game.input.down = {}; game.input.was = {};
  game.startLevel(LEVEL - 1);
}

const TRACE = String(opt('tracehero', '')).split(',').filter(Boolean).map(Number);
let jumpTimer = 0, atkTimer = 0, maxX = 0, minHp = 99, deaths = 0, hits = 0;
const total = Math.round(SECONDS / STEP);
for (let i = 0; i < total; i++) {
  const t = i * STEP;
  if (BOT) {
    const h = game.hero;
    const map = game.tilemap;
    const T = (v) => map.isSolid(v, 0) || false;   // unused, kept for clarity
    const solidAt = (tx, ty) => map.isSolid(tx, ty);
    const overPit = () => {
      const x0 = Math.floor((h.x - 4) / 16), x1 = Math.floor((h.x + 4) / 16);
      const y0 = Math.floor(h.bottom / 16);
      for (let ty = y0; ty <= map.h; ty++)
        for (let tx = x0; tx <= x1; tx++) if (solidAt(tx, ty)) return false;
      return true;
    };
    const edgeAhead = () => {                        // a gap starts right in front
      const tx = Math.floor((h.x + 7) / 16), ty = Math.floor(h.bottom / 16);
      return !solidAt(tx, ty) && !solidAt(tx, ty + 1);
    };
    const wallAhead = () => solidAt(Math.floor((h.x + 8) / 16), Math.floor((h.bottom - 7) / 16));
    const enemyNear = game.enemies.some(e => Math.abs(e.x - h.x) < 34 && Math.abs(e.y - h.y) < 24);
    jumpTimer -= STEP; atkTimer -= STEP;
    key('right', true);

    if (game.state !== 'play') {                     // mash through menus / retries
      key('jump', (i % 20) < 10); key('right', false); jumpTimer = 0.3;
    } else if ((edgeAhead() || wallAhead()) && h.onGround && jumpTimer <= 0) {
      key('jump', true); jumpTimer = 0.32; h.__dj = false;
    } else if (!h.onGround && h.vy > 0.4 && overPit() && !h.__dj) {
      key('jump', true); jumpTimer = 0.22; h.__dj = true;      // rescue double jump
    } else if (jumpTimer < 0.16) {
      key('jump', false);
    }
    if (h.onGround) h.__dj = false;
    if (enemyNear && atkTimer <= 0) { key('attack', true); atkTimer = 0.3; }
    else if (atkTimer < 0.15) key('attack', false);
  }
  if (KILLAT > 0 && t >= KILLAT && game.state === 'play') game.hero.die(game, 'hp');
  if (GOTO > 0 && t >= 0.4 && game.state === 'play' && !game.__gone) {
    game.hero.x = GOTO * 16; game.hero.y = (LEVEL_ROW() - 1) * 16; game.__gone = true;
  }
  try {
    game.step(STEP);
  } catch (e) { errors.push(e); break; }
  input.update(STEP);
  if (SHOTS.some(s => Math.abs(s - t) < STEP / 2)) { game.render(); capture(SHOTS.find(s => Math.abs(s - t) < STEP / 2)); }
  const h = game.hero;
  if (TRACE.length === 2 && t >= TRACE[0] && t <= TRACE[1]) {
    console.log(`t=${t.toFixed(2)} x=${h.x.toFixed(1)} y=${h.y.toFixed(1)} vx=${h.vx.toFixed(2)} vy=${h.vy.toFixed(2)} ` +
                `ground=${h.onGround ? 1 : 0} state=${h.state} tileX=${(h.x / 16).toFixed(1)}`);
  }
  if (NOENEMY) game.enemies.length = 0;
  if (GODMODE) { h.hp = h.maxHp; h.invuln = 1; }
  maxX = Math.max(maxX, h.x); minHp = Math.min(minHp, h.hp);
  if (game.state === 'dead' && deaths === 0) { deaths++; LOG(`  hero died at t=${t.toFixed(1)}s x=${h.x.toFixed(0)}`); }
  if (h.state === 'hurt') hits++;
}
const h = game.hero;
LOG('--- summary ---');
LOG(`  state        : ${game.state}`);
LOG(`  hero furthest: x=${maxX.toFixed(0)}px (${(maxX / 16).toFixed(1)} tiles) of ${LEVEL_0W()}px`);
LOG(`  hero now     : x=${h.x.toFixed(0)} y=${h.y.toFixed(0)} hp=${h.hp} coins=${h.coins} state=${h.state}`);
LOG(`  score        : ${game.score}   enemies left: ${game.enemies.length}  pickups left: ${game.pickups.length}`);
LOG(`  damage ticks : ${hits}   deaths: ${deaths}`);
LOG(`  errors       : ${errors.length}`);
for (const e of errors.slice(0, 3)) console.log(String(e.stack || e).split('\n').slice(0, 4).join('\n'));

function LEVEL_0W() { return game.tilemap.w * 16; }
function LEVEL_ROW() { return game.tilemap.level.groundRow; }
if (errors.length) process.exitCode = 1;
