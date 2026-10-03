/* levels.js — level data, the tilemap and the parallax scenery
 * ------------------------------------------------------------------
 * A level is plain data: ground spans, floating platforms, blocks, spikes,
 * enemies, pickups and props.  The tile grid and the pre-rendered backdrop
 * are derived from it, so you can redesign a level by editing the numbers.
 *
 * Tile ids                       solid?
 *   0 empty                       no
 *   1 dirt / grass top            yes
 *   2 weathered stone             yes
 *   3 wooden beam                 yes
 *   4 crate (breakable-looking)   yes
 *   5 spikes                      no  (they hurt)
 *   6 wooden platform             yes, but only from above (one-way)
 */

export const TILE = 16;
export const T = { EMPTY: 0, GROUND: 1, STONE: 2, WOOD: 3, CRATE: 4, SPIKES: 5, PLATFORM: 6 };
export const SOLID = new Set([T.GROUND, T.STONE, T.WOOD, T.CRATE, T.PLATFORM]);

/* ------------------------------------------------------------------ levels */
/** helper: a row of coins */
const row = (x, y, n, step = 1) => ({ x, y, n, step, kind: 'row' });
/** helper: an arc of coins (nice over a jump) */
const arc = (x, y, n, step = 1, h = 1.6) => ({ x, y, n, step, h, kind: 'arc' });

export const LEVELS = [
  {
    name: '1-1  Sunlit Meadows',
    hint: 'Reach the banner!  ← → move · SPACE jump (twice for a double jump) · X swing',
    w: 176, h: 16, groundRow: 13,
    theme: { grass: true, sky: ['#3b2f63', '#7b4a86', '#e2725b'] },
    spawn: { x: 3, y: 11 },
    ground: [[0, 24], [28, 49], [53, 79], [84, 105], [110, 134], [138, 176]],
    platforms: [
      { x: 12, y: 10, w: 4 }, { x: 18, y: 8, w: 3 },
      { x: 30, y: 10, w: 5 }, { x: 39, y: 7, w: 4 },
      { x: 56, y: 9, w: 6 }, { x: 66, y: 6, w: 3 },
      { x: 72, y: 10, w: 4 },
      { x: 86, y: 9, w: 4 }, { x: 92, y: 6, w: 5 },
      { x: 112, y: 10, w: 4 }, { x: 120, y: 7, w: 4 },
      { x: 128, y: 10, w: 5 },
      { x: 142, y: 9, w: 4 }, { x: 150, y: 6, w: 3 }, { x: 158, y: 9, w: 5 },
    ],
    blocks: [
      { x: 40, y: 11, w: 2, h: 2, kind: 'stone' },
      { x: 80, y: 12, w: 2, h: 1, kind: 'crate' },
      { x: 106, y: 11, w: 1, h: 2, kind: 'wood' },
      { x: 134, y: 10, w: 2, h: 3, kind: 'stone' },
      { x: 164, y: 11, w: 2, h: 2, kind: 'crate' },
    ],
    spikes: [{ x: 60, w: 3 }, { x: 116, w: 2 }],
    coins: [row(12, 8, 4), arc(22, 11, 4), row(30, 8, 5), arc(47, 11, 5, 1, 2.0),
            row(56, 7, 6), arc(78, 11, 5, 1, 2.2), row(92, 4, 5), arc(104, 11, 5),
            row(112, 8, 4), arc(133, 11, 4, 1, 1.8), row(150, 4, 3), arc(168, 11, 5)],
    hearts: [{ x: 70, y: 4 }],
    potions: [{ x: 104, y: 9 }],
    enemies: [
      { type: 'slime', x: 14 }, { type: 'slime', x: 34 }, { type: 'slime', x: 43 },
      { type: 'bat', x: 62, y: 8 }, { type: 'slime', x: 68 },
      { type: 'slime', x: 88 }, { type: 'bat', x: 96, y: 7 },
      { type: 'slime', x: 114 }, { type: 'slime', x: 126 }, { type: 'bat', x: 130, y: 6 },
      { type: 'slime', x: 146 }, { type: 'slime', x: 154 }, { type: 'bat', x: 160, y: 7 },
      { type: 'slime', x: 166 },
    ],
    props: [
      { kind: 'tree', x: 6 }, { kind: 'bush', x: 18 }, { kind: 'tuft', x: 10 },
      { kind: 'cloud', x: 40, y: 3 }, { kind: 'cloud', x: 96, y: 2 }, { kind: 'cloud', x: 150, y: 3 },
      { kind: 'sign', x: 8, text: 'Reach the banner' },
      { kind: 'tree', x: 33 }, { kind: 'tuft', x: 30 }, { kind: 'bush', x: 40 },
      { kind: 'rock', x: 55 }, { kind: 'torch', x: 63 }, { kind: 'tuft', x: 60 },
      { kind: 'tree_small', x: 86 }, { kind: 'bush', x: 94 }, { kind: 'tuft', x: 90 },
      { kind: 'rock', x: 100 }, { kind: 'torch', x: 119 },
      { kind: 'tree', x: 118 }, { kind: 'bush', x: 124 }, { kind: 'tuft', x: 128 },
      { kind: 'tree_small', x: 142 }, { kind: 'bush', x: 148 }, { kind: 'tuft', x: 152 },
      { kind: 'rock', x: 162 }, { kind: 'flag', x: 172 },
    ],
    goal: 172,
  },

  {
    name: '1-2  The Old Quarry',
    hint: 'Mind the spikes — bats dive when you get close',
    w: 190, h: 16, groundRow: 13,
    theme: { grass: false, sky: ['#2a2a4d', '#4d3f6d', '#a06a6a'] },
    spawn: { x: 3, y: 11 },
    ground: [[0, 18], [21, 40], [45, 66], [70, 92], [96, 120], [124, 148], [152, 190]],
    platforms: [
      { x: 10, y: 9, w: 4 }, { x: 16, y: 6, w: 3 },
      { x: 25, y: 10, w: 4 }, { x: 33, y: 7, w: 4 },
      { x: 47, y: 9, w: 5 }, { x: 56, y: 6, w: 4 }, { x: 62, y: 10, w: 3 },
      { x: 74, y: 10, w: 3 }, { x: 80, y: 7, w: 5 }, { x: 88, y: 10, w: 3 },
      { x: 100, y: 9, w: 4 }, { x: 108, y: 6, w: 4 }, { x: 114, y: 10, w: 4 },
      { x: 128, y: 10, w: 3 }, { x: 134, y: 7, w: 4 }, { x: 142, y: 10, w: 4 },
      { x: 156, y: 9, w: 5 }, { x: 166, y: 6, w: 4 }, { x: 174, y: 9, w: 4 },
    ],
    blocks: [
      { x: 38, y: 11, w: 2, h: 3, kind: 'stone' },
      { x: 68, y: 10, w: 2, h: 3, kind: 'stone' },
      { x: 94, y: 11, w: 2, h: 2, kind: 'wood' },
      { x: 122, y: 10, w: 2, h: 3, kind: 'stone' },
      { x: 150, y: 10, w: 2, h: 3, kind: 'stone' },
    ],
    spikes: [{ x: 30, w: 4 }, { x: 60, w: 4 }, { x: 84, w: 5 }, { x: 110, w: 4 },
             { x: 138, w: 5 }, { x: 162, w: 3 }],
    coins: [row(10, 7, 4), arc(18, 11, 4, 1, 2.0), row(33, 5, 4), arc(40, 11, 6, 1, 2.2),
            row(47, 7, 5), arc(66, 11, 5, 1, 2.0), row(80, 5, 5), arc(92, 11, 5, 1, 2.4),
            row(100, 7, 4), arc(120, 11, 5, 1, 2.0), row(134, 5, 4), arc(148, 11, 5, 1, 2.2),
            row(166, 4, 4), arc(180, 11, 6)],
    hearts: [{ x: 56, y: 4 }, { x: 134, y: 3 }],
    potions: [{ x: 108, y: 4 }],
    enemies: [
      { type: 'slime', x: 12 }, { type: 'bat', x: 24, y: 8 }, { type: 'slime', x: 34 },
      { type: 'slime', x: 48 }, { type: 'bat', x: 56, y: 7 }, { type: 'slime', x: 64 },
      { type: 'slime', x: 76 }, { type: 'bat', x: 82, y: 6 }, { type: 'slime', x: 88 },
      { type: 'slime', x: 102 }, { type: 'bat', x: 112, y: 8 }, { type: 'slime', x: 116 },
      { type: 'slime', x: 130 }, { type: 'bat', x: 140, y: 7 }, { type: 'slime', x: 144 },
      { type: 'slime', x: 158 }, { type: 'bat', x: 168, y: 6 }, { type: 'slime', x: 176 },
    ],
    props: [
      { kind: 'rock', x: 6 }, { kind: 'rock', x: 24 }, { kind: 'torch', x: 22 },
      { kind: 'rock', x: 46 }, { kind: 'torch', x: 50 }, { kind: 'rock', x: 62 },
      { kind: 'torch', x: 72 }, { kind: 'rock', x: 90 }, { kind: 'torch', x: 98 },
      { kind: 'rock', x: 104 }, { kind: 'torch', x: 126 }, { kind: 'rock', x: 132 },
      { kind: 'torch', x: 154 }, { kind: 'rock', x: 160 }, { kind: 'rock', x: 178 },
      { kind: 'cloud', x: 60, y: 2 }, { kind: 'cloud', x: 130, y: 3 },
      { kind: 'flag', x: 186 },
    ],
    goal: 186,
  },

  {
    name: '1-3  Skyward Ruins',
    hint: 'Long jumps ahead — use the double jump and keep moving',
    w: 186, h: 16, groundRow: 13,
    theme: { grass: false, sky: ['#221c46', '#41437a', '#7a6ba8'] },
    spawn: { x: 3, y: 11 },
    ground: [[0, 14], [18, 30], [36, 50], [58, 70], [79, 92], [100, 112],
             [120, 132], [141, 154], [163, 186]],
    platforms: [
      // stepping stones across the pits - three tiles up, one jump away
      { x: 14, y: 10, w: 4 }, { x: 30, y: 10, w: 4 }, { x: 50, y: 10, w: 4 },
      { x: 70, y: 10, w: 4 }, { x: 92, y: 10, w: 4 }, { x: 112, y: 10, w: 4 },
      { x: 132, y: 10, w: 4 }, { x: 154, y: 10, w: 4 },
      // bonus route up high
      { x: 8, y: 6, w: 3 }, { x: 40, y: 6, w: 3 }, { x: 84, y: 6, w: 4 },
      { x: 124, y: 6, w: 3 }, { x: 168, y: 6, w: 4 },
    ],
    blocks: [
      { x: 26, y: 11, w: 2, h: 2, kind: 'stone' },
      { x: 46, y: 10, w: 2, h: 3, kind: 'wood' },
      { x: 66, y: 11, w: 2, h: 2, kind: 'stone' },
      { x: 88, y: 10, w: 3, h: 3, kind: 'stone' },
      { x: 108, y: 11, w: 2, h: 2, kind: 'crate' },
      { x: 128, y: 10, w: 2, h: 3, kind: 'stone' },
      { x: 150, y: 11, w: 2, h: 2, kind: 'wood' },
      { x: 176, y: 10, w: 2, h: 3, kind: 'stone' },
    ],
    spikes: [{ x: 20, w: 3 }, { x: 44, w: 3 }, { x: 82, w: 3 }, { x: 104, w: 3 },
             { x: 124, w: 3 }, { x: 166, w: 3 }],
    coins: [arc(14, 11, 4), row(30, 6, 4), arc(36, 11, 4, 1, 2.0), row(50, 6, 4),
            arc(58, 11, 4, 1, 2.2), row(70, 7, 4), arc(79, 11, 4, 1, 2.0), row(88, 7, 5),
            arc(100, 11, 4, 1, 2.2), row(112, 7, 4), arc(120, 11, 4, 1, 2.0), row(132, 6, 4),
            arc(141, 11, 4, 1, 2.2), row(154, 7, 4), arc(163, 11, 4, 1, 2.0),
            row(176, 7, 4), row(178, 4, 4)],
    hearts: [{ x: 84, y: 3 }, { x: 168, y: 4 }],
    potions: [{ x: 40, y: 3 }],
    enemies: [
      { type: 'slime', x: 8 }, { type: 'bat', x: 16, y: 6 }, { type: 'slime', x: 24 },
      { type: 'bat', x: 40, y: 7 }, { type: 'slime', x: 44 }, { type: 'bat', x: 62, y: 6 },
      { type: 'slime', x: 66 }, { type: 'bat', x: 74, y: 5 }, { type: 'slime', x: 86 },
      { type: 'bat', x: 96, y: 7 }, { type: 'slime', x: 106 }, { type: 'bat', x: 116, y: 5 },
      { type: 'slime', x: 126 }, { type: 'bat', x: 136, y: 7 }, { type: 'slime', x: 148 },
      { type: 'bat', x: 158, y: 5 }, { type: 'slime', x: 170 }, { type: 'bat', x: 178, y: 6 },
    ],
    props: [
      { kind: 'rock', x: 4 }, { kind: 'torch', x: 12 }, { kind: 'rock', x: 22 },
      { kind: 'torch', x: 34 }, { kind: 'rock', x: 44 }, { kind: 'torch', x: 56 },
      { kind: 'rock', x: 64 }, { kind: 'torch', x: 76 }, { kind: 'rock', x: 86 },
      { kind: 'torch', x: 98 }, { kind: 'rock', x: 106 }, { kind: 'torch', x: 118 },
      { kind: 'rock', x: 126 }, { kind: 'torch', x: 138 }, { kind: 'rock', x: 148 },
      { kind: 'torch', x: 160 }, { kind: 'rock', x: 170 },
      { kind: 'cloud', x: 30, y: 2 }, { kind: 'cloud', x: 100, y: 3 }, { kind: 'cloud', x: 160, y: 2 },
      { kind: 'flag', x: 182 },
    ],
    goal: 182,
  },
];

/* ---------------------------------------------------------------- tilemap */
export class Tilemap {
  constructor(level, sheets) {
    this.level = level;
    this.sheets = sheets;
    this.w = level.w;
    this.h = level.h;
    this.grid = new Uint8Array(this.w * this.h);
    this.buildGrid();
    this.canvas = this.bake();
  }

  idx(tx, ty) { return ty * this.w + tx; }
  at(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return tx < 0 || tx >= this.w ? T.STONE : T.EMPTY;
    return this.grid[this.idx(tx, ty)];
  }
  isSolid(tx, ty) { return SOLID.has(this.at(tx, ty)); }
  isSpike(tx, ty) { return this.at(tx, ty) === T.SPIKES; }
  isPlatform(tx, ty) { return this.at(tx, ty) === T.PLATFORM; }

  buildGrid() {
    const L = this.level, g = this.grid;
    const fill = (x, y, id) => { if (x >= 0 && y >= 0 && x < this.w && y < this.h) g[this.idx(x, y)] = id; };
    for (const [x0, x1] of L.ground || [])
      for (let x = x0; x < x1; x++) for (let y = L.groundRow; y < this.h; y++) fill(x, y, T.GROUND);
    for (const b of L.blocks || []) {
      const id = b.kind === 'crate' ? T.CRATE : b.kind === 'wood' ? T.WOOD : T.STONE;
      for (let x = b.x; x < b.x + b.w; x++) for (let y = b.y; y < b.y + (b.h || 1); y++) fill(x, y, id);
    }
    for (const p of L.platforms || [])
      for (let x = p.x; x < p.x + p.w; x++) fill(x, p.y, T.PLATFORM);
    // Spikes sit *on top of* whatever terrain is under them: stand on the
    // ground, on a stone block, on a crate - never buried inside it.
    for (const s of L.spikes || []) {
      for (let x = s.x; x < s.x + s.w; x++) {
        let row = -1;
        for (let y = 0; y < this.h; y++) {
          const id = g[this.idx(x, y)];
          if (id === T.GROUND || id === T.STONE || id === T.WOOD || id === T.CRATE) { row = y; break; }
        }
        if (row > 0) fill(x, row - 1, T.SPIKES);
        else if (row < 0) fill(x, L.groundRow - 1, T.SPIKES);
      }
    }
  }

  /** everything static is drawn once into one big offscreen canvas */
  bake() {
    const cv = document.createElement('canvas');
    cv.width = this.w * TILE;
    cv.height = this.h * TILE;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const tiles = this.sheets.tiles, props = this.sheets.props;
    const rect = (name) => tiles.anims[name].frames[0];
    const grass = this.level.theme.grass !== false;      // grass or bare stone?

    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        const id = this.grid[this.idx(tx, ty)];
        if (id === T.EMPTY) continue;
        const x = tx * TILE, y = ty * TILE;
        const openTop = !this.isSolid(tx, ty - 1) && !this.isSpike(tx, ty - 1);
        let name = null;
        if (id === T.GROUND) {
          if (openTop) {
            const l = this.isSolid(tx - 1, ty), r = this.isSolid(tx + 1, ty);
            const pre = grass ? 'ground_top' : 'stone_top';
            if (!grass) name = pre;
            else name = !l && r ? 'ground_top_l' : l && !r ? 'ground_top_r'
                                : !l && !r ? 'ground_top' : 'ground_top_m';
          } else name = grass ? 'dirt' : 'stone';
        } else if (id === T.STONE) name = openTop ? 'stone_top' : 'stone';
        else if (id === T.WOOD) name = 'wood';
        else if (id === T.CRATE) name = 'crate';
        else if (id === T.PLATFORM) name = 'platform';
        else if (id === T.SPIKES) name = 'spikes';
        if (name) {
          const r = rect(name);
          c.drawImage(tiles.image, r[0], r[1], r[2], r[3], x, y, r[2], r[3]);
        }
      }
    }
    // props, sorted so nearer (larger y) ones overlap correctly
    const list = [...(this.level.props || [])].sort((a, b) => (a.y || 99) - (b.y || 99));
    for (const p of list) {
      const a = props.anims[p.kind];
      if (!a) continue;
      const r = a.frames[0];
      const gy = (p.y !== undefined ? p.y : this.rowY(this.level.groundRow));
      c.drawImage(props.image, r[0], r[1], r[2], r[3],
                  Math.round(p.x * TILE + TILE / 2 - 16), Math.round(gy - 31));
    }
    return cv;
  }

  rowY(row) { return row * TILE; }
}

/* ------------------------------------------------------------ backgrounds */
export function drawBackground(c, sheets, cam, level, time) {
  const W = c.canvas.width, H = c.canvas.height;
  const far = sheets.bg_far, mid = sheets.bg_mid;
  // sky gradient underneath everything (covers any gap at the edges)
  const sky = c.createLinearGradient(0, 0, 0, H);
  const [a, b, d] = level.theme.sky;
  sky.addColorStop(0, a); sky.addColorStop(0.62, b); sky.addColorStop(1, d);
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);

  const tileX = (img, k, off) => {
    const w = img.width;
    let x = -(((cam.x * k) + off) % w);
    if (x > 0) x -= w;
    return x;
  };
  // far layer: sky band, hills, moon
  let x = tileX(far, 0.16, 0);
  const fy = -42.6 - cam.y * 0.30;
  for (; x < W; x += far.width) c.drawImage(far, Math.round(x), Math.round(fy));
  // near layer: treeline
  x = tileX(mid, 0.34, 0);
  const my = 1 - cam.y * 0.50;
  for (; x < W; x += mid.width) c.drawImage(mid, Math.round(x), Math.round(my));
}
