const ROOT = './2d_car_game_assets_high_quality/';

export const ASSET_PATHS = {
  atlas: `${ROOT}00_master_asset_atlas.png`,
  cars: `${ROOT}01_cars_vehicles.png`,
  wheels: `${ROOT}02_wheels_parts.png`,
  terrain: `${ROOT}03_terrain_road.png`,
  background: `${ROOT}04_background_environment.png`,
  weather: `${ROOT}05_changing_world_weather.png`,
  gravity: `${ROOT}06_gravity_system.png`,
  particles: `${ROOT}07_particles_crash_effects.png`,
  collectibles: `${ROOT}08_collectibles.png`,
  powerups: `${ROOT}09_powerups.png`,
  ui: `${ROOT}10_ui_assets.png`,
  garage: `${ROOT}11_garage_upgrades.png`,
  missions: `${ROOT}12_missions_rewards.png`,
  animation: `${ROOT}13_animation_sprite_sheets.png`
};

// Regions are deliberately kept in source-sheet coordinates. The artwork is not
// flattened into full-sheet cards at runtime: every draw samples only the sprite
// needed for the current object.
export const SPRITES = {
  cars: {
    trailblazer: { x: 9, y: 39, w: 134, h: 91 },
    skyline: { x: 156, y: 38, w: 138, h: 91 },
    titan: { x: 294, y: 27, w: 111, h: 104 },
    scout: { x: 403, y: 40, w: 109, h: 93 },
    pulse: { x: 8, y: 147, w: 147, h: 78 },
    phantom: { x: 155, y: 145, w: 141, h: 84 },
    dune: { x: 294, y: 151, w: 111, h: 82 },
    redline: { x: 402, y: 142, w: 112, h: 86 }
  },
  wheels: {
    wheelSteel: { x: 7, y: 40, w: 48, h: 48 },
    wheelGold: { x: 64, y: 40, w: 48, h: 48 },
    wheelRed: { x: 121, y: 40, w: 48, h: 48 },
    springRed: { x: 6, y: 177, w: 31, h: 73 },
    springBlue: { x: 132, y: 177, w: 31, h: 73 }
  },
  terrain: {
    grassHill: { x: 11, y: 43, w: 86, h: 57 },
    grassValley: { x: 99, y: 43, w: 88, h: 58 },
    grassSmall: { x: 191, y: 43, w: 74, h: 55 },
    dirtFlat: { x: 13, y: 205, w: 83, h: 39 },
    woodBridge: { x: 99, y: 193, w: 94, h: 49 },
    rock: { x: 185, y: 124, w: 89, h: 52 },
    ice: { x: 306, y: 121, w: 92, h: 59 },
    ramp: { x: 364, y: 262, w: 100, h: 93 },
    lava: { x: 282, y: 357, w: 88, h: 59 },
    gravityPlatform: { x: 367, y: 359, w: 91, h: 54 }
  },
  background: {
    green: { x: 5, y: 34, w: 292, h: 80 },
    desert: { x: 5, y: 118, w: 292, h: 69 },
    snow: { x: 304, y: 117, w: 247, h: 69 },
    forest: { x: 5, y: 195, w: 292, h: 72 },
    volcano: { x: 304, y: 194, w: 247, h: 72 }
  },
  weather: {
    clear: { x: 6, y: 37, w: 99, h: 52 },
    sunset: { x: 111, y: 37, w: 99, h: 52 },
    night: { x: 215, y: 37, w: 99, h: 52 },
    storm: { x: 319, y: 37, w: 99, h: 52 },
    snow: { x: 423, y: 37, w: 99, h: 52 },
    moon: { x: 6, y: 101, w: 122, h: 55 },
    lava: { x: 210, y: 166, w: 91, h: 43 }
  },
  gravity: {
    bluePortal: { x: 4, y: 38, w: 49, h: 49 },
    purplePortal: { x: 58, y: 38, w: 49, h: 49 },
    redFlip: { x: 111, y: 38, w: 49, h: 49 },
    greenWall: { x: 166, y: 38, w: 49, h: 49 },
    up: { x: 221, y: 38, w: 49, h: 49 },
    gravityOrb: { x: 3, y: 101, w: 47, h: 47 },
    flipOrb: { x: 54, y: 101, w: 47, h: 47 },
    gravityStar: { x: 109, y: 101, w: 47, h: 47 },
    portal: { x: 161, y: 150, w: 51, h: 55 }
  },
  collectibles: {
    coin: { x: 4, y: 41, w: 40, h: 47 },
    coinGold: { x: 43, y: 41, w: 40, h: 47 },
    gemBlue: { x: 86, y: 39, w: 45, h: 50 },
    gemPurple: { x: 133, y: 39, w: 45, h: 50 },
    fuel: { x: 180, y: 39, w: 42, h: 50 },
    energy: { x: 225, y: 39, w: 43, h: 50 },
    star: { x: 3, y: 98, w: 48, h: 47 },
    heart: { x: 55, y: 99, w: 45, h: 44 },
    magnet: { x: 105, y: 98, w: 47, h: 47 },
    shield: { x: 160, y: 98, w: 46, h: 47 }
  },
  powerups: {
    nitro: { x: 7, y: 37, w: 51, h: 53 },
    magnet: { x: 64, y: 36, w: 51, h: 53 },
    shield: { x: 122, y: 36, w: 51, h: 53 },
    slowmo: { x: 179, y: 36, w: 51, h: 53 },
    superJump: { x: 238, y: 36, w: 51, h: 53 },
    airControl: { x: 7, y: 99, w: 51, h: 53 },
    doubleCoin: { x: 64, y: 99, w: 51, h: 53 },
    gravityBoost: { x: 238, y: 99, w: 51, h: 53 }
  },
  ui: {
    pause: { x: 14, y: 67, w: 48, h: 45 },
    trophy: { x: 147, y: 114, w: 53, h: 52 },
    gameOver: { x: 227, y: 113, w: 110, h: 54 },
    complete: { x: 20, y: 113, w: 110, h: 54 },
    record: { x: 340, y: 113, w: 113, h: 54 }
  },
  missions: {
    star: { x: 5, y: 39, w: 49, h: 49 },
    trophy: { x: 59, y: 35, w: 50, h: 53 },
    shield: { x: 112, y: 35, w: 50, h: 53 },
    crown: { x: 166, y: 35, w: 56, h: 53 },
    chest: { x: 7, y: 143, w: 55, h: 48 },
    rewardChest: { x: 68, y: 139, w: 70, h: 53 }
  },
  garage: {
    engine: { x: 15, y: 65, w: 56, h: 54 },
    grip: { x: 76, y: 65, w: 56, h: 54 },
    suspension: { x: 137, y: 65, w: 56, h: 54 },
    fuel: { x: 198, y: 65, w: 56, h: 54 },
    turbo: { x: 260, y: 65, w: 56, h: 54 },
    armor: { x: 322, y: 65, w: 56, h: 54 }
  }
};

export class AssetStore {
  constructor() {
    this.images = {};
    this.loaded = false;
  }

  async load() {
    const entries = Object.entries(ASSET_PATHS);
    await Promise.all(entries.map(([key, src]) => new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => { this.images[key] = image; resolve(); };
      image.onerror = () => reject(new Error(`Unable to load ${src}`));
      image.src = src;
    })));
    this.loaded = true;
    return this;
  }

  get(sheet) { return this.images[sheet]; }

  draw(ctx, sheet, region, x, y, width, height, rotation = 0, alpha = 1) {
    const image = this.images[sheet];
    const r = typeof region === 'string' ? SPRITES[sheet]?.[region] : region;
    if (!image || !r) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    if (rotation) ctx.rotate(rotation);
    ctx.drawImage(image, r.x, r.y, r.w, r.h, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  drawAt(ctx, sheet, region, x, y, width, height, alpha = 1) {
    const image = this.images[sheet];
    const r = typeof region === 'string' ? SPRITES[sheet]?.[region] : region;
    if (!image || !r) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(image, r.x, r.y, r.w, r.h, x, y, width, height);
    ctx.restore();
  }
}

export const worldBackground = {
  green: 'green', desert: 'desert', snow: 'snow', storm: 'volcano', volcano: 'volcano'
};
