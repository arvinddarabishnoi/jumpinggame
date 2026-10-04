import { SPRITES } from './assets.js';

export const CAR_CONFIGS = {
  trailblazer: { name: 'TRAILBLAZER', className: 'ALL-TERRAIN / A', sprite: 'trailblazer', color: '#e84f42', base: { speed: 1, grip: 1.02, suspension: 1, fuel: 1, nitro: 1, armor: 1, airControl: 1 } },
  skyline: { name: 'SKYLINE', className: 'AERO / B', sprite: 'skyline', color: '#38a9ef', base: { speed: 1.18, grip: .94, suspension: .9, fuel: .88, nitro: 1.1, armor: .8, airControl: 1.12 }, unlock: 600 },
  titan: { name: 'TITAN', className: 'HEAVY / S', sprite: 'titan', color: '#79cc36', base: { speed: .85, grip: 1.16, suspension: 1.32, fuel: 1.12, nitro: .86, armor: 1.35, airControl: .78 }, unlock: 1100 },
  dune: { name: 'DUNE HAWK', className: 'RALLY / A', sprite: 'dune', color: '#ffbd3d', base: { speed: 1.08, grip: 1.06, suspension: 1.02, fuel: .97, nitro: 1.2, armor: .92, airControl: 1.3 }, unlock: 1750 }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Player {
  constructor() {
    this.x = 160; this.y = 240; this.vx = 0; this.vy = 0;
    this.angle = 0; this.angularVelocity = 0;
    this.grounded = false; this.contacts = 0;
    this.wheelRadius = 18; this.width = 128; this.height = 82;
    this.spin = 0; this.damage = 0; this.healthState = 'NORMAL';
    this.nitro = 100;
    this.airtime = 0;
    this.lastImpact = 0;
    this.carId = 'trailblazer';
    this.effects = {};
  }

  configure(carId) { this.carId = CAR_CONFIGS[carId] ? carId : 'trailblazer'; }

  reset(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.angle = 0; this.angularVelocity = 0;
    this.grounded = false; this.contacts = 0; this.spin = 0; this.damage = 0; this.healthState = 'NORMAL'; this.nitro = 100; this.airtime = 0; this.lastImpact = 0;
    this.effects = {};
  }

  stats(upgrades) {
    const car = CAR_CONFIGS[this.carId] || CAR_CONFIGS.trailblazer;
    const level = (name) => Math.max(0, (upgrades?.[name] || 1) - 1);
    return {
      speed: car.base.speed * (1 + level('engine') * .065),
      grip: car.base.grip * (1 + level('grip') * .075),
      suspension: car.base.suspension * (1 + level('suspension') * .09),
      fuel: car.base.fuel * (1 + level('fuel') * .12),
      nitro: car.base.nitro * (1 + level('nitro') * .12),
      armor: car.base.armor * (1 + level('armor') * .14),
      airControl: car.base.airControl * (1 + level('airControl') * .1),
      gravity: 1 + level('gravity') * .12
    };
  }

  wheelWorld(localX, localY) {
    const cos = Math.cos(this.angle); const sin = Math.sin(this.angle);
    return { x: this.x + localX * cos - localY * sin, y: this.y + localX * sin + localY * cos };
  }

  update(dt, controls, terrain, gravityMode, upgrades, particles, audio) {
    const stats = this.stats(upgrades);
    const previousGrounded = this.grounded;
    const gravity = gravityMode === 'reverse' ? 405 * stats.gravity : gravityMode === 'low' ? -275 / stats.gravity : -625 * stats.gravity;
    const throttle = controls.accelerate ? 1 : 0;
    const reversing = controls.reverse ? 1 : 0;
    const nitro = controls.nitro && this.nitro > 0;
    this.vy += gravity * dt;

    const forwardForce = 500 * stats.speed;
    const reverseForce = 260 * stats.speed;
    if (throttle) this.vx += forwardForce * dt;
    if (reversing) this.vx -= reverseForce * dt;
    if (nitro) {
      this.vx += 860 * stats.nitro * dt;
      this.nitro = Math.max(0, this.nitro - 28 * dt / Math.max(.75, stats.nitro));
      if (Math.random() < dt * 18) particles.emit(this.x - 50, this.y - 17, 'spark', 2, { angle: Math.PI + (Math.random() - .5) * .5, speed: 80, life: .24, size: 2, gravity: -15 });
    }

    // Gravity wells are exciting, but horizontal momentum remains controllable.
    const surfaceSlope = terrain.slopeAt(this.x);
    if (this.grounded && gravityMode === 'normal') this.vx += -Math.sin(surfaceSlope) * (210 + Math.abs(this.vx) * .08) * dt;
    const drag = this.grounded ? (controls.accelerate || controls.reverse ? .994 : .982) : .998;
    this.vx *= Math.pow(drag, dt * 60);
    const maxSpeed = 590 * stats.speed + (nitro ? 250 : 0);
    this.vx = clamp(this.vx, -240 * stats.speed, maxSpeed);

    const airTorque = 12.5 * stats.airControl * (this.effects.airControl ? 1.65 : 1);
    if (!this.grounded) {
      if (controls.airFront) this.angularVelocity += airTorque * dt;
      if (controls.airBack) this.angularVelocity -= airTorque * dt;
      this.angularVelocity *= Math.pow(.997, dt * 60);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.angularVelocity * dt;
    this.spin += this.vx * dt / this.wheelRadius;

    // Resolve each wheel independently. This keeps the chassis connected to the surface
    // while still allowing a single wheel to leave a crest during a jump.
    const wheelLocals = [[-43, -21], [43, -21]];
    let correction = 0; let slopeTotal = 0; let contacts = 0; let strongestImpact = 0;
    for (const [localX, localY] of wheelLocals) {
      const wheel = this.wheelWorld(localX, localY);
      const ground = terrain.heightAt(wheel.x);
      if (ground === null) continue;
      const penetration = ground + this.wheelRadius - wheel.y;
      if (penetration > 0) {
        correction += Math.min(32, penetration);
        slopeTotal += terrain.slopeAt(wheel.x);
        contacts += 1;
        strongestImpact = Math.max(strongestImpact, Math.max(0, -this.vy));
      }
    }
    this.contacts = contacts;
    this.grounded = contacts > 0 && gravityMode !== 'reverse';
    if (previousGrounded && !this.grounded && gravityMode === 'normal') {
      // A rising lip transfers a little of the car's forward momentum into lift.
      // It makes authored gaps readable without turning every flat edge into a jump pad.
      const launchSlope = terrain.slopeAt(this.x - 34);
      if (launchSlope > .055) this.vy += Math.min(150, Math.sin(launchSlope) * 340);
    }
    if (contacts) {
      this.y += correction / contacts * .78;
      if (this.vy < 0) {
        const bounce = .08 + .04 * Math.min(1.5, stats.suspension);
        this.vy = strongestImpact > 40 ? strongestImpact * bounce : 0;
      } else this.vy *= .35;
      const targetAngle = slopeTotal / contacts;
      const spring = Math.min(1, dt * (7 + stats.grip * 2));
      this.angle += (targetAngle - this.angle) * spring;
      this.angularVelocity += (targetAngle - this.angle) * 5 * dt;
      this.angularVelocity *= Math.pow(.82 + Math.min(.13, stats.grip * .035), dt * 60);
      if (Math.abs(this.vx) < 5 && !throttle && !reversing) this.vx = 0;
    }

    if (this.grounded && !previousGrounded) {
      this.lastImpact = strongestImpact;
      this.airtime = 0;
      audio?.event('landing');
      if (strongestImpact > 210 && !this.effects.shield) particles.burst(this.x, this.y - 20, 'dust', 1.3);
    } else if (!this.grounded) this.airtime += dt;
    if (this.grounded && this.vx > 260 && Math.random() < dt * 10) particles.emit(this.x - 35, this.y - 24, 'dust', 2, { angle: Math.PI * .8 + (Math.random() - .5) * .5, speed: 24, spread: .8, life: .45, size: 3, gravity: -12 });

    // Damage is applied to impactful landings. A shield turns one rough landing into
    // a visual spark moment without bypassing the rest of the physics.
    if (this.grounded && !previousGrounded && strongestImpact > 280) {
      const mitigation = this.effects.shield ? .25 : 1;
      this.damage += (strongestImpact - 250) * .045 * mitigation / stats.armor;
      if (this.damage > 72) this.healthState = 'HEAVY DAMAGE';
      else if (this.damage > 32) this.healthState = 'DAMAGED';
      if (!this.effects.shield && strongestImpact > 420) {
        this.damage += 25 / stats.armor;
        audio?.event('crash');
        particles.burst(this.x, this.y, 'spark', 1.4);
      }
    }
    this.damage = Math.max(0, this.damage - dt * .35);
    if (this.damage < 30 && this.healthState !== 'WRECK') this.healthState = 'NORMAL';
    if (this.damage >= 100) this.healthState = 'WRECK';

    if (!Number.isFinite(this.x + this.y + this.vx + this.vy + this.angle)) {
      this.reset(160, 245);
    }
    audio?.engine(this.vx, throttle);
    return { previousGrounded, strongestImpact, wasNitro: nitro };
  }

  getState() {
    return {
      x: this.x, y: this.y, vx: this.vx, vy: this.vy, angle: this.angle, angularVelocity: this.angularVelocity,
      grounded: this.grounded, contacts: this.contacts, spin: this.spin, damage: this.damage, healthState: this.healthState,
      nitro: this.nitro, airtime: this.airtime
    };
  }

  restore(state) {
    if (!state) return;
    Object.assign(this, state);
  }

  draw(ctx, assets, project, theme, gravityMode, reducedMotion = false) {
    const screen = project(this.x, this.y);
    const car = CAR_CONFIGS[this.carId] || CAR_CONFIGS.trailblazer;
    const sprite = SPRITES.cars[car.sprite];
    const w = car.sprite === 'titan' ? 144 : car.sprite === 'pulse' ? 151 : 142;
    const h = car.sprite === 'titan' ? 112 : 91;
    // A soft contact shadow is independent from the sprite and follows each wheel.
    if (this.grounded) {
      ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = '#07131e'; ctx.beginPath(); ctx.ellipse(screen.x, screen.y + 35, 57, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (gravityMode !== 'normal') {
      ctx.save(); ctx.translate(screen.x, screen.y); ctx.globalAlpha = .26; ctx.strokeStyle = gravityMode === 'reverse' ? '#ff648e' : '#c18cff'; ctx.lineWidth = 2; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(0, 0, 61 + Math.sin(performance.now() / 100) * 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.translate(screen.x, screen.y - 5); ctx.rotate(-this.angle);
    if (this.effects.shield) { ctx.globalAlpha = .65; ctx.strokeStyle = '#70e9ff'; ctx.lineWidth = 3; ctx.shadowColor = '#70e9ff'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.ellipse(0, 0, w * .56, h * .56, 0, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
    assets.draw(ctx, 'cars', sprite, 0, 0, w, h, 0, 1);
    // The source car already contains its correct wheel art. Small spin glints make wheel
    // rotation legible without replacing those authored wheels.
    if (!reducedMotion && Math.abs(this.vx) > 120) {
      ctx.globalAlpha = .55; ctx.strokeStyle = '#d6f0ec'; ctx.lineWidth = 1.2;
      for (const wx of [-43, 43]) { ctx.beginPath(); ctx.arc(wx, 20, 12, this.spin % 6.28, (this.spin % 6.28) + .7); ctx.stroke(); }
    }
    ctx.restore();
    if (this.effects.nitro || this.vx > 400) {
      ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = '#71ebff'; ctx.shadowColor = '#71ebff'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(screen.x - 60, screen.y + 4); ctx.lineTo(screen.x - 100 - Math.min(30, this.vx * .04), screen.y + 1); ctx.lineTo(screen.x - 63, screen.y + 13); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
}
