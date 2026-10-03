/* entities.js — the hero, the enemies, pickups and particles
 * ------------------------------------------------------------------
 * Units: pixels and "per 60Hz step" velocities.  The game runs a fixed
 * timestep, so these numbers stay stable no matter the display refresh rate.
 */

import { TILE, T } from './levels.js';
import { draw } from './loader.js';

export const PHYS = {
  GRAVITY: 0.50, MAX_FALL: 9.0,
  RUN_ACCEL: 0.72, AIR_ACCEL: 0.50, RUN_MAX: 2.62,
  FRICTION: 0.38, AIR_FRICTION: 0.015,   // momentum carries through a jump
  JUMP_V: -8.40, DOUBLE_V: -7.40, JUMP_CUT: 0.42,
  COYOTE: 0.10, BUFFER: 0.13,
  STOMP_V: -6.4,
};

export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const sign = (v) => v < 0 ? -1 : v > 0 ? 1 : 0;

/* ------------------------------------------------------------------ base */
class Body {
  constructor(x, y, w, h) {
    this.x = x; this.y = y;           // x = centre, y = feet
    this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.dead = false;
    this.remove = false;
  }
  get left() { return this.x - this.w / 2; }
  get right() { return this.x + this.w / 2; }
  get top() { return this.y - this.h; }
  get bottom() { return this.y; }
  get cx() { return this.x; }
  get cy() { return this.y - this.h / 2; }

  rect() { return { x: this.left, y: this.top, w: this.w, h: this.h }; }

  overlaps(o) {
    return this.left < o.right && this.right > o.left && this.top < o.bottom && this.bottom > o.top;
  }
  overlapsRect(r) {
    return this.left < r.x + r.w && this.right > r.x && this.top < r.y + r.h && this.bottom > r.y;
  }

  /* --- tile collision, resolved one axis at a time ------------------- */
  moveX(map) {
    this.x += this.vx;
    if (this.noTileCollide) return;
    const y0 = Math.floor(this.top / TILE), y1 = Math.floor((this.bottom - 0.01) / TILE);
    if (this.vx > 0) {
      const tx = Math.floor((this.right - 0.01) / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        if (map.isSolid(tx, ty) && !map.isPlatform(tx, ty)) {
          this.x = tx * TILE - this.w / 2 - 0.01;
          this.vx = 0; this.hitWall = 1;
          break;
        }
      }
    } else if (this.vx < 0) {
      const tx = Math.floor(this.left / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        if (map.isSolid(tx, ty) && !map.isPlatform(tx, ty)) {
          this.x = (tx + 1) * TILE + this.w / 2 + 0.01;
          this.vx = 0; this.hitWall = -1;
          break;
        }
      }
    }
  }

  moveY(map, dropThrough = false) {
    const prevBottom = this.bottom;
    this.y += this.vy;
    if (this.noTileCollide) return;
    const x0 = Math.floor(this.left / TILE), x1 = Math.floor((this.right - 0.01) / TILE);
    this.onGround = false;
    if (this.vy >= 0) {                                  // falling
      const ty = Math.floor((this.bottom - 0.01) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const id = map.at(tx, ty);
        const solid = map.isSolid(tx, ty);
        const oneWay = id === T.PLATFORM;
        if (!solid) continue;
        if (oneWay && (dropThrough || prevBottom > ty * TILE + 1.5)) continue;
        if (!oneWay || this.vy >= 0) {
          this.y = ty * TILE;
          this.vy = 0; this.onGround = true;
          break;
        }
      }
    } else {                                             // rising
      const ty = Math.floor(this.top / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (map.isSolid(tx, ty) && !map.isPlatform(tx, ty)) {
          this.y = (ty + 1) * TILE + this.h;
          this.vy = 0;
          break;
        }
      }
    }
  }

  /** overlaps a spike tile? */
  touchingSpikes(map) {
    const x0 = Math.floor(this.left / TILE), x1 = Math.floor((this.right - 0.01) / TILE);
    const y0 = Math.floor(this.top / TILE), y1 = Math.floor((this.bottom - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (map.isSpike(tx, ty)) return true;
    return false;
  }
}

/* ------------------------------------------------------------------ hero */
export class Hero extends Body {
  constructor(x, y) {
    super(x, y, 9, 22);
    this.hp = 5; this.maxHp = 5;
    this.state = 'idle';
    this.animTime = 0;
    this.stateTime = 0;
    this.coyote = 0; this.buffer = 0;
    this.airJumps = 1;
    this.attackTimer = -1;
    this.invuln = 0;
    this.hitIds = null;
    this.coins = 0;
    this.attackHit = false;
  }

  get attacking() { return this.state === 'attack'; }
  /** the sword's damage window: frames 1-3 of the 6-frame swing */
  get attackActive() { return this.attackTimer >= 1 / 17 && this.attackTimer <= 3.4 / 17; }

  attackRect() {
    const reach = 19, up = 6;
    return {
      x: this.facing > 0 ? this.x + 2 : this.x - 2 - reach,
      y: this.top - up,
      w: reach, h: this.h + 6,
    };
  }

  hurt(dmg, fromX, world) {
    if (this.invuln > 0 || this.state === 'death') return false;
    this.hp -= dmg;
    this.invuln = 1.15;
    const dir = sign(this.x - fromX) || -this.facing;
    if (this.hp <= 0) {
      this.die(world, 'hp');
      return true;
    }
    this.state = 'hurt';
    this.stateTime = 0; this.animTime = 0;
    this.vx = dir * 2.2; this.vy = -4.2;
    this.facing = -dir;
    world.shake(3.2, 0.16);
    world.hitstop(0.08);
    world.audio.hurt();
    world.spark(this.x, this.cy, 8, '#ff6b6b');
    return true;
  }

  die(world, cause = 'hp') {
    if (this.state === 'death') return;
    this.state = 'death';
    this.stateTime = 0; this.animTime = 0;
    this.vx = cause === 'pit' ? 0 : -1.2 * this.facing;
    this.vy = cause === 'pit' ? 1 : -4.6;
    world.audio.death();
    world.shake(4, 0.3);
  }

  handleInput(input, world) {
    const { PHYS: P } = { PHYS };
    if (this.state === 'death') return;
    const left = input.isDown('left'), right = input.isDown('right');
    const maxSpd = P.RUN_MAX;
    if (this.state !== 'hurt') {
      const accel = this.onGround ? P.RUN_ACCEL : P.AIR_ACCEL;
      if (left && !right) { this.vx -= accel; this.facing = -1; }
      else if (right && !left) { this.vx += accel; this.facing = 1; }
      else {
        const f = this.onGround ? P.FRICTION : P.AIR_FRICTION;
        if (Math.abs(this.vx) <= f) this.vx = 0; else this.vx -= sign(this.vx) * f;
      }
      this.vx = clamp(this.vx, -maxSpd, maxSpd);
    }

    if (this.state === 'hurt') { this.buffer = 0; return; }

    // jump with coyote time + input buffering + one air jump
    if (input.justPressed('jump')) this.buffer = P.BUFFER;
    this.buffer = Math.max(0, this.buffer - world.dt);
    if (this.buffer > 0) {
      if (this.onGround || this.coyote > 0) {
        this.vy = P.JUMP_V;
        this.buffer = 0; this.coyote = 0; this.onGround = false;
        this.state = 'jump'; this.stateTime = 0; this.animTime = 0;
        world.audio.jump();
        world.dust(this.x, this.y, 5, -0.6);
      } else if (this.airJumps > 0 && this.state !== 'attack') {
        this.airJumps--; this.vy = P.DOUBLE_V; this.buffer = 0;
        this.state = 'jump'; this.stateTime = 0; this.animTime = 0;
        world.audio.double();
        world.ring(this.x, this.cy + 4);
      }
    }
    // variable jump height
    if (!input.isDown('jump') && this.vy < 0 && this.state === 'jump') this.vy *= 1 - P.JUMP_CUT * 0.25;

    // attack
    if (input.justPressed('attack') && this.state !== 'attack' && this.state !== 'hurt') {
      this.state = 'attack';
      this.stateTime = 0; this.animTime = 0;
      this.attackTimer = 0;
      this.attackHit = false;
      world.audio.swing();
      if (this.onGround) this.vx *= 0.55;
    }
    if (this.attackTimer >= 0) {
      this.attackTimer += world.dt;
      if (this.attackTimer > 6 / 17) { this.attackTimer = -1; if (this.state === 'attack') this.state = this.onGround ? 'idle' : 'fall'; }
      else if (this.attackActive && !this.attackHit) {
        if (world.hitEnemies(this.attackRect(), 1, this.facing, this)) this.attackHit = true;
      }
    }
  }

  update(world) {
    this.stateTime += world.dt;
    this.invuln = Math.max(0, this.invuln - world.dt);
    if (this.onGround) { this.coyote = PHYS.COYOTE; this.airJumps = 1; }
    else this.coyote = Math.max(0, this.coyote - world.dt);

    if (this.state !== 'death') this.handleInput(world.input, world);

    this.hitWall = 0;
    const dropThrough = world.input.isDown('down');
    this.moveX(world.tilemap);
    this.vy = Math.min(this.vy + PHYS.GRAVITY, PHYS.MAX_FALL);
    const wasAir = !this.onGround;
    this.moveY(world.tilemap, dropThrough);

    // landing
    if (wasAir && this.onGround && this.state !== 'death') {
      const impact = Math.min(1, Math.abs(world.prevVy || 0) / 8);
      if (impact > 0.35) {
        world.audio.land();
        world.dust(this.x, this.y, 3 + Math.round(impact * 5), 0.35);
        if (impact > 0.75) world.shake(1.6, 0.1);
        if (this.state !== 'attack') { this.state = 'land'; this.stateTime = 0; this.animTime = 0; }
      }
      if (this.state === 'jump' || this.state === 'fall') {
        this.state = 'idle'; this.stateTime = 0; this.animTime = 0;
      }
    }
    world.prevVy = this.vy;

    // spikes + pits
    if (this.state !== 'death') {
      if (this.touchingSpikes(world.tilemap)) {
        world.audio.spike();
        if (this.hurt(1, this.x, world)) { this.vy = -5.4; this.onGround = false; }
      }
      if (this.y > world.tilemap.h * TILE + 30) this.die(world, 'pit');
    }

    // state / animation bookkeeping
    if (this.state === 'hurt' && this.stateTime > 0.34) this.state = this.onGround ? 'idle' : 'fall';
    if (this.state === 'land' && this.stateTime > 2 / 14) this.state = 'idle';
    if (this.state === 'death' && this.stateTime > 6 / 8 + 0.6) this.dead = true;

    this.animate(world);
  }

  animName() {
    switch (this.state) {
      case 'death': return 'death';
      case 'hurt': return 'hurt';
      case 'attack': return 'attack';
      case 'land': return 'land';
    }
    if (!this.onGround) return this.vy < 0 ? 'jump' : 'fall';
    return Math.abs(this.vx) > 0.35 ? 'run' : 'idle';
  }

  animate(world) {
    const name = this.animName();
    if (name !== this.anim) { this.anim = name; this.animTime = 0; }
    // running plays faster the quicker you go; everything else realtime
    let rate = 1;
    if (name === 'run') rate = 0.8 + 0.65 * Math.min(1.4, Math.abs(this.vx) / PHYS.RUN_MAX);
    this.animTime += world.dt * rate;
  }

  render(c, sheets, time) {
    const anim = sheets.hero.get(this.anim || 'idle');
    const flicker = this.invuln > 0 && Math.floor(this.invuln * 22) % 2 === 0;
    if (flicker) c.globalAlpha = 0.45;
    draw(c, anim, this.animTime, this.x, this.y, { flip: this.facing < 0 });
    c.globalAlpha = 1;
  }
}

/* ---------------------------------------------------------------- enemies */
export class Enemy extends Body {
  constructor(x, y, w, h, hp) {
    super(x, y, w, h);
    this.hp = hp; this.maxHp = hp;
    this.state = 'idle';
    this.stateTime = 0; this.animTime = 0;
    this.invuln = 0;
    this.flash = 0;
  }

  /** damage from a sword hit or a stomp */
  takeHit(dmg, fromX, world, dir) {
    if (this.state === 'death' || this.invuln > 0) return false;
    this.hp -= dmg;
    this.invuln = 0.12;
    this.flash = 0.1;
    if (this.hp <= 0) {
      this.state = 'death'; this.stateTime = 0; this.animTime = 0;
      this.vx = (dir || sign(this.x - fromX) || 1) * 0.6;
      world.audio.enemyDown();
      world.spark(this.cx, this.cy, 12, this.sparkColor || '#ffe9a8');
      world.burst(this.cx, this.cy, 6, this.sparkColor || '#ffe9a8');
      return true;
    }
    this.state = 'hurt'; this.stateTime = 0; this.animTime = 0;
    this.vx = (dir || sign(this.x - fromX) || 1) * 1.4;
    world.audio.hitEnemy();
    world.hitstop(0.05);
    world.spark(this.cx, this.cy, 6, '#fff6cf');
    return true;
  }

  baseUpdate(world) {
    this.stateTime += world.dt;
    this.animTime += world.dt;
    this.invuln = Math.max(0, this.invuln - world.dt);
    this.flash = Math.max(0, this.flash - world.dt);
  }
}

/* --- slime: patrols, hops at you, lunges a bite ------------------------- */
export class Slime extends Enemy {
  constructor(x, y) {
    super(x, y, 13, 12, 2);
    this.sparkColor = '#8ef08a';
    this.hopTimer = rnd(0.6, 1.6);
    this.biteTimer = 0;
    this.homeX = x;
    this.patrol = 26;
  }

  update(world) {
    this.baseUpdate(world);
    const hero = world.hero;
    if (this.state === 'death') {
      this.vx *= 0.85;
      this.moveX(world.tilemap);
      this.vy = Math.min(this.vy + PHYS.GRAVITY, PHYS.MAX_FALL);
      this.moveY(world.tilemap);
      if (this.stateTime > 5 / 8) this.remove = true;
      return;
    }
    if (this.state === 'hurt') {
      this.vx *= 0.8;
      this.moveX(world.tilemap);
      this.vy = Math.min(this.vy + PHYS.GRAVITY, PHYS.MAX_FALL);
      this.moveY(world.tilemap);
      if (this.stateTime > 3 / 10) this.state = 'idle';
      return;
    }

    const dx = hero.x - this.x, dy = hero.y - this.y;
    const near = Math.abs(dx) < 70 && Math.abs(dy) < 26 && hero.state !== 'death';
    this.facing = dx < 0 ? -1 : 1;

    if (near && Math.abs(dx) < 22 && Math.abs(dy) < 18) {
      // bite!
      if (this.state !== 'attack') { this.state = 'attack'; this.stateTime = 0; this.animTime = 0; }
      this.vx *= 0.7;
      if (this.stateTime > 4 / 12) { this.state = 'idle'; this.stateTime = 0; this.biteTimer = 0.7; }
      const bite = { x: this.x + this.facing * 2, y: this.top - 3, w: 12, h: this.h + 3 };
      world.hurtPlayerIfTouching(bite, 1, this.x, this);
    } else if (this.state === 'attack') {
      if (this.stateTime > 4 / 12) this.state = 'idle';
    } else {
      // wander / hop toward the player
      this.hopTimer -= world.dt;
      this.vx *= 0.86;
      if (this.onGround && this.hopTimer <= 0) {
        const dir = near ? sign(dx) : (this.x - this.homeX > this.patrol ? -1 : this.x - this.homeX < -this.patrol ? 1 : (Math.random() < 0.5 ? -1 : 1));
        this.vx = dir * (near ? 1.15 : 0.7);
        this.vy = near ? -3.5 : -2.6;
        this.state = 'hop'; this.stateTime = 0; this.animTime = 0;
        this.hopTimer = near ? rnd(0.7, 1.1) : rnd(1.1, 2.2);
      }
    }

    if (this.state === 'hop' && this.onGround && this.stateTime > 0.3) { this.state = 'idle'; this.stateTime = 0; }
    this.moveX(world.tilemap);
    this.vy = Math.min(this.vy + PHYS.GRAVITY, PHYS.MAX_FALL);
    this.moveY(world.tilemap);
    // don't walk off a ledge while idling
    if (this.onGround && Math.abs(this.vx) > 0.4) {
      const ahead = Math.floor((this.x + sign(this.vx) * (this.w / 2 + 3)) / TILE);
      const below = Math.floor((this.bottom + 3) / TILE);
      if (!world.tilemap.isSolid(ahead, below)) { this.vx = -sign(this.vx) * 0.5; }
    }
    // contact damage
    world.hurtPlayerIfTouching(this.rect(), 1, this.x, this);
  }

  animName() {
    if (this.state === 'death') return 'death';
    if (this.state === 'hurt') return 'hurt';
    if (this.state === 'attack') return 'attack';
    if (!this.onGround) return 'fall';
    return this.state === 'hop' ? 'hop' : 'idle';
  }

  render(c, sheets) {
    const name = this.animName();
    if (name !== this.anim) { this.anim = name; this.animTime = 0; }
    const a = sheets.slime.get(name);
    const t = name === 'death' ? Math.min(this.stateTime, a.duration) : this.animTime;
    c.save();
    if (this.flash > 0) { c.globalAlpha = 0.9; }
    draw(c, a, t, this.x, this.y, { flip: this.facing < 0 });
    c.restore();
    if (this.flash > 0) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.5;
      draw(c, a, t, this.x, this.y, { flip: this.facing < 0 });
      c.restore();
    }
  }
}

/* --- bat: hovers on a sine, dives when you get close -------------------- */
export class Bat extends Enemy {
  constructor(x, y) {
    super(x, y, 12, 11, 1);
    this.sparkColor = '#c9b6ff';
    this.homeY = y;
    this.t = rnd(0, 6);
    this.mode = 'fly';              // fly | dive | recover
    this.diveT = 0;
    this.noTileCollide = true;
  }

  update(world) {
    this.baseUpdate(world);
    const hero = world.hero;
    this.t += world.dt;
    if (this.state === 'death') {
      this.vy = Math.min(this.vy + PHYS.GRAVITY * 0.6, PHYS.MAX_FALL);
      this.vx *= 0.98;
      this.x += this.vx; this.y += this.vy;
      if (this.stateTime > 4 / 9 + 0.3) this.remove = true;
      return;
    }
    if (this.state === 'hurt') {
      this.vx *= 0.9; this.vy *= 0.9;
      this.x += this.vx; this.y += this.vy;
      this.y = Math.min(this.y, this.homeY + 24);
      if (this.stateTime > 2 / 9) { this.state = 'fly'; this.mode = 'recover'; this.diveT = 0; }
      return;
    }

    const dx = hero.x - this.x, dy = hero.cy - this.cy;
    const dist = Math.hypot(dx, dy);
    this.facing = dx < 0 ? -1 : 1;

    if (this.mode === 'fly') {
      this.vy = Math.sin(this.t * 2.2) * 0.55;
      this.vx = Math.cos(this.t * 0.7) * 0.35;
      if (dist < 92 && hero.state !== 'death') { this.mode = 'dive'; this.diveT = 0; }
    } else if (this.mode === 'dive') {
      this.diveT += world.dt;
      const sp = 2.5;
      this.vx = (dx / (dist || 1)) * sp;
      this.vy = (dy / (dist || 1)) * sp;
      if (this.diveT > 0.85) { this.mode = 'recover'; this.diveT = 0; }
    } else {
      this.diveT += world.dt;
      this.vx *= 0.94;
      this.vy = (this.homeY - this.y) > 0 ? 1.3 : -0.9;
      if (this.diveT > 0.9) { this.mode = 'fly'; this.diveT = 0; }
    }
    this.x += this.vx;
    this.y += this.vy;
    this.y = clamp(this.y, this.homeY - 26, this.homeY + 34);
    this.x = clamp(this.x, this.homeX - 60, this.homeX + 60);
    world.hurtPlayerIfTouching(this.rect(), 1, this.x, this);
  }

  animName() {
    if (this.state === 'death') return 'death';
    if (this.state === 'hurt') return 'hurt';
    return this.mode === 'dive' ? 'dive' : 'fly';
  }

  render(c, sheets) {
    const name = this.animName();
    if (name !== this.anim) { this.anim = name; this.animTime = 0; }
    const a = sheets.bat.get(name);
    const t = name === 'death' ? Math.min(this.stateTime, a.duration) : this.animTime;
    draw(c, a, t, this.x, this.y, { flip: this.facing < 0 });
  }
}

/* ---------------------------------------------------------------- pickups */
export class Pickup extends Body {
  constructor(x, y, kind) {
    super(x, y, 10, 10);
    this.kind = kind;            // coin | heart | potion
    this.t = Math.random() * 4;
    this.baseY = y;
    this.vy = 0;
    this.noTileCollide = true;
    this.gravity = kind !== 'coin';
    this.anim = { coin: 'coin0', heart: 'heart', potion: 'potion' }[kind];
  }
  update(world) {
    this.t += world.dt;
    if (this.gravity) {
      this.vy = Math.min(this.vy + PHYS.GRAVITY * 0.6, 6);
      this.y += this.vy;
      if (this.y >= this.baseY) { this.y = this.baseY; this.vy = 0; }
    }
    if (this.overlaps(world.hero)) {
      this.collect(world);
      this.remove = true;
    }
  }
  collect(world) {
    const h = world.hero;
    if (this.kind === 'coin') {
      h.coins++; world.score += 10;
      world.audio.coin();
      world.spark(this.x, this.cy, 6, '#ffe27a');
      if (h.coins % 20 === 0 && h.hp < h.maxHp) { h.hp++; world.audio.heart(); world.flash('+1 ♥'); }
    } else if (this.kind === 'heart') {
      h.hp = Math.min(h.maxHp, h.hp + 1);
      world.audio.heart();
      world.spark(this.x, this.cy, 10, '#ff8b93');
      world.flash('+1 ♥');
    } else {
      h.hp = Math.min(h.maxHp, h.hp + 2);
      world.audio.heart();
      world.spark(this.x, this.cy, 12, '#7fe7ff');
      world.flash('+2 ♥');
    }
  }
  render(c, sheets, time) {
    const tiles = sheets.tiles;
    let rect;
    if (this.kind === 'coin') {
      const names = ['coin0', 'coin1', 'coin2', 'coin3'];
      const f = Math.sin(this.t * 4.4) * 0.5 + 0.5;
      rect = tiles.anims[names[Math.round(f * 3)]].frames[0];
    } else {
      rect = tiles.anims[this.anim].frames[0];
    }
    const bob = this.kind === 'coin' ? Math.sin(this.t * 3.1) * 1.6 : 0;
    c.drawImage(tiles.image, rect[0], rect[1], rect[2], rect[3],
                Math.round(this.x - 8), Math.round(this.baseY - 16 + bob));
  }
}

/* -------------------------------------------------------------- particles */
export class Particles {
  constructor() { this.list = []; }
  add(p) { if (this.list.length < 420) this.list.push(p); }
  dust(x, y, n = 4, spread = 1) {
    for (let i = 0; i < n; i++)
      this.add({ x, y: y - 1, vx: rnd(-0.9, 0.9) * spread, vy: rnd(-1.3, -0.2) * spread,
                 life: rnd(0.22, 0.45), max: 0.45, size: rnd(1, 2.2), col: '#e8dcc6', grav: 0.06 });
  }
  spark(x, y, n = 6, col = '#ffe27a') {
    for (let i = 0; i < n; i++)
      this.add({ x, y, vx: rnd(-2.2, 2.2), vy: rnd(-2.2, 1.2), life: rnd(0.16, 0.4),
                 max: 0.4, size: rnd(1, 2.4), col, grav: 0.12, glow: true });
  }
  burst(x, y, n = 8, col = '#ffffff') {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.add({ x, y, vx: Math.cos(a) * rnd(1.2, 2.4), vy: Math.sin(a) * rnd(1.2, 2.4),
                 life: rnd(0.25, 0.5), max: 0.5, size: rnd(1.4, 3), col, grav: 0.02, glow: true });
    }
  }
  ring(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.add({ x, y, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 0.7 + 0.4,
                 life: 0.35, max: 0.35, size: 1.8, col: '#bff3ff', grav: 0.03, glow: true });
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += (p.grav || 0);
      p.x += p.vx; p.y += p.vy;
      if (p.glow) { p.vx *= 0.94; p.vy *= 0.96; }
    }
    this.list = this.list.filter(p => p.life > 0);
  }
  render(c) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.max);
      c.globalAlpha = a;
      c.fillStyle = p.col;
      const s = Math.max(1, p.size * (0.4 + a * 0.8));
      c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s));
    }
    c.globalAlpha = 1;
  }
}
