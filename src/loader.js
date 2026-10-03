/* loader.js — asset loading + sprite sheet animation
 * ------------------------------------------------------------------
 * Every sheet ships with a small JSON atlas (frame rects, fps, loop flag
 * and the foot anchor) so this file never needs to know any pixel values.
 */

export const ASSETS = [
  'assets/hero', 'assets/slime', 'assets/bat',   // sheets: .png + .json
  'assets/tiles', 'assets/props',
  'assets/bg_far.png', 'assets/bg_mid.png',      // plain images
];

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('could not load ' + src));
    img.src = src;
  });
}

async function loadJSON(src) {
  const r = await fetch(src);
  if (!r.ok) throw new Error('could not load ' + src + ' (' + r.status + ')');
  return r.json();
}

/** An animation: a list of frames on one sheet, played at `fps`. */
export class Anim {
  constructor(sheet, def) {
    this.sheet = sheet;
    this.frames = def.frames;
    this.fps = def.fps || 10;
    this.loop = def.loop !== false;
    this.duration = this.frames.length / this.fps;
  }
  /** frame index for elapsed time t (seconds) */
  index(t) {
    const n = this.frames.length;
    if (n === 1) return 0;
    let f = Math.floor(t * this.fps);
    if (this.loop) return ((f % n) + n) % n;
    return Math.min(n - 1, Math.max(0, f));
  }
  frame(t) { return this.frames[this.index(t)]; }
  /** has a non-looping animation finished? */
  done(t) { return !this.loop && t >= this.duration; }
  rect(t) { return this.frames[this.index(t)]; }
}

/** A character (or tileset) with all of its animations. */
export class SpriteSet {
  constructor(image, meta) {
    this.image = image;
    this.meta = meta;
    this.anims = {};
    for (const [name, def] of Object.entries(meta.animations)) {
      // a tile / prop sheet packs single frames in a grid: keep them separate
      this.anims[name] = new Anim(image, def);
    }
    this.anchor = meta.anchor;
    this.cell = meta.cell;
  }
  get(name) { return this.anims[name]; }
  has(name) { return !!this.anims[name]; }
  /** one-shot helper: returns [rect, finished] */
  frameOf(name, t) {
    const a = this.anims[name];
    return [a.rect(t), a.done(t)];
  }
}

/**
 * Draw one animation frame.
 *   x, y   : world position of the sprite's anchor (feet centre for characters)
 *   flip   : mirror horizontally (characters are drawn facing right)
 */
export function draw(ctx, anim, t, x, y, opts = {}) {
  const { flip = false, alpha = 1, ox = 0, oy = 0, scale = 1 } = opts;
  if (!anim) return;
  const r = anim.rect(t);
  const ax = r[2] * 0.5, ay = r[3];          // frame centre-x / bottom
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x) + ox, Math.round(y) + oy);
  if (flip) ctx.scale(-1, 1);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.drawImage(anim.sheet, r[0], r[1], r[2], r[3], -ax, -ay, r[2], r[3]);
  ctx.restore();
}

/** Draw a raw frame rect from a sheet (used for tiles, props, background). */
export function blit(ctx, image, rect, x, y, opts = {}) {
  const { flip = false, alpha = 1, sx = 1, sy = 1 } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (flip) {
    ctx.translate(Math.round(x) + rect[2] * sx, Math.round(y));
    ctx.scale(-1, 1);
  } else {
    ctx.translate(Math.round(x), Math.round(y));
  }
  ctx.drawImage(image, rect[0], rect[1], rect[2], rect[3],
                0, 0, rect[2] * sx, rect[3] * sy);
  ctx.restore();
}

export async function loadAll(onProgress = () => {}) {
  const names = ASSETS.filter(a => !a.endsWith('.png'));
  const plain = ASSETS.filter(a => a.endsWith('.png'));
  const out = {};
  let done = 0;
  const total = names.length * 2 + plain.length;
  const tick = () => onProgress(++done / total);

  await Promise.all(names.map(async base => {
    const [json, img] = await Promise.all([loadJSON(base + '.json'), loadImage(base + '.png')]);
    tick(); tick();
    out[base.split('/').pop()] = new SpriteSet(img, json);
  }));
  await Promise.all(plain.map(async p => {
    const img = await loadImage(p);
    tick();
    out[p.split('/').pop().replace('.png', '')] = img;
  }));
  return out;
}
