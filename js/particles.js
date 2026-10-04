const PALETTE = {
  dust: ['#b08a5e', '#d4b178', '#f0d19b'],
  spark: ['#fff0a5', '#ffb84f', '#ff6e3d'],
  gravity: ['#d4a5ff', '#9a6eff', '#64e3ff'],
  coin: ['#fff2a0', '#ffcf55', '#e69121'],
  snow: ['#f2fbff', '#bfe4f4', '#8cc7df'],
  lava: ['#fff095', '#ffad3d', '#f14b2c'],
  smoke: ['#73818a', '#9da7a7', '#d3c5ad']
};

export class ParticleSystem {
  constructor(settings) {
    this.settings = settings;
    this.items = [];
    this.max = 430;
  }

  emit(x, y, type = 'dust', count = 8, options = {}) {
    if (this.settings.reducedMotion) count = Math.ceil(count * .45);
    const colors = PALETTE[type] || PALETTE.dust;
    for (let i = 0; i < count; i += 1) {
      if (this.items.length >= this.max) this.items.shift();
      const angle = options.angle ?? (Math.random() * Math.PI * 2);
      const spread = options.spread ?? 1;
      const speed = options.speed ?? (18 + Math.random() * 54);
      this.items.push({
        x, y,
        vx: Math.cos(angle) * speed * spread + (options.vx || 0),
        vy: Math.sin(angle) * speed * spread + (options.vy || 0),
        life: options.life ?? (.35 + Math.random() * .5),
        maxLife: options.life ?? (.35 + Math.random() * .5),
        size: options.size ?? (2 + Math.random() * 5),
        color: colors[(Math.random() * colors.length) | 0],
        type,
        gravity: options.gravity ?? -30,
        drag: options.drag ?? .96,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - .5) * 7
      });
    }
  }

  burst(x, y, type = 'spark', intensity = 1) {
    const count = Math.round((type === 'gravity' ? 18 : 12) * intensity);
    this.emit(x, y, type, count, { speed: 50 + 80 * intensity, spread: 1.1, life: .55 + .25 * intensity, size: 2 + intensity * 2, gravity: type === 'gravity' ? 0 : -90 });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) { this.items.splice(i, 1); continue; }
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
    }
  }

  draw(ctx, project) {
    ctx.save();
    for (const p of this.items) {
      const point = project(p.x, p.y);
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      const size = p.size * (p.type === 'smoke' ? 1.2 + (1 - alpha) : 1);
      ctx.globalAlpha = alpha * (p.type === 'smoke' ? .42 : .86);
      ctx.fillStyle = p.color;
      if (p.type === 'spark' || p.type === 'gravity' || p.type === 'coin') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = size * 3;
      } else ctx.shadowBlur = 0;
      if (p.type === 'spark') {
        ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(p.rotation); ctx.fillRect(-size * 1.8, -size * .35, size * 3.6, size * .7); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(point.x, point.y, size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
}
