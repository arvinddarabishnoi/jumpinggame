import { SPRITES } from './assets.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function color(hex) { const s = hex.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
function mix(a, b, t) { const A = color(a), B = color(b); return `rgb(${Math.round(lerp(A[0],B[0],t))},${Math.round(lerp(A[1],B[1],t))},${Math.round(lerp(A[2],B[2],t))})`; }

export class Renderer {
  constructor(canvas, assets, terrain, particles, settings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.assets = assets;
    this.terrain = terrain;
    this.particles = particles;
    this.settings = settings;
    this.width = 900; this.height = 600; this.dpr = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = Math.max(320, window.innerWidth);
    this.height = Math.max(480, window.innerHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  project(x, y, camera) {
    return { x: x - camera.x, y: this.height - (y - camera.y) };
  }

  render(game, preview = false) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const shake = this.settings.screenShake && !this.settings.reducedMotion ? game.camera.shake : 0;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    if (shake > 0.1) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    const focusX = preview ? 750 : game.player.x;
    const theme = this.terrain.themeAt(focusX);
    const transition = this.getThemeTransition(focusX, theme);
    this.drawSky(ctx, theme, transition);
    this.drawParallax(ctx, game.camera, theme, focusX, preview);

    const project = (x, y) => this.project(x, y, game.camera);
    this.terrain.draw(ctx, project, this.assets, game.camera.x - 160, game.camera.x + this.width + 180, this.height + 160);
    this.drawWorldDecor(ctx, game, theme, project);
    if (!preview) this.drawCollectibles(ctx, game, project);
    if (!preview) this.drawGravityEffects(ctx, game, project);
    this.particles.draw(ctx, project);
    this.drawFloaters(ctx, game, project);

    if (preview) this.drawPreviewRig(ctx, game, project);
    else game.player.draw(ctx, this.assets, project, theme, game.gravityMode, this.settings.reducedMotion);
    this.drawForegroundAtmosphere(ctx, game, theme, preview);
    ctx.restore();
  }

  getThemeTransition(x, theme) {
    const next = this.terrain.themes().find((t) => t.start > x && t.start - x < 480);
    if (!next) return null;
    return { next, amount: clamp(1 - (next.start - x) / 480, 0, 1) };
  }

  drawSky(ctx, theme, transition) {
    let top = theme.skyTop, bottom = theme.skyBottom;
    if (transition) { top = mix(top, transition.next.skyTop, transition.amount); bottom = mix(bottom, transition.next.skyBottom, transition.amount); }
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, top); grad.addColorStop(.58, bottom); grad.addColorStop(1, mix(bottom, '#0c2631', .38));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, this.width, this.height);
    if (theme.id === 'storm' || theme.id === 'volcano') { ctx.fillStyle = 'rgba(9,18,37,.22)'; ctx.fillRect(0,0,this.width,this.height * .55); }
  }

  drawParallax(ctx, camera, theme, focusX, preview) {
    const horizon = this.height * .48;
    // Sun / moon keeps a fixed point in the sky while the authored background sheets
    // slide at three different speeds underneath it.
    ctx.save();
    ctx.globalAlpha = theme.id === 'storm' || theme.id === 'volcano' ? .35 : .8;
    ctx.fillStyle = theme.id === 'volcano' ? '#ffad68' : theme.id === 'snow' ? '#f5ffff' : '#fff1ab';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(this.width * .78, this.height * .2, theme.id === 'storm' ? 22 : 30, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const panel = theme.id === 'green' ? 'green' : theme.id === 'desert' ? 'desert' : theme.id === 'snow' ? 'snow' : theme.id === 'volcano' ? 'volcano' : 'forest';
    const source = SPRITES.background[panel];
    const panelW = theme.id === 'snow' || theme.id === 'volcano' ? 390 : 440;
    const panelH = 122;
    const baseX = -((camera.x * .12) % panelW) - panelW;
    ctx.save(); ctx.globalAlpha = .72;
    for (let x = baseX; x < this.width + panelW; x += panelW) this.assets.drawAt(ctx, 'background', source, x, horizon - 82, panelW, panelH, .7);
    ctx.restore();

    // Far ridge, mid ridge, and vegetation read separately even when the art sheet is
    // transitioning between worlds.
    this.drawRidge(ctx, horizon + 18, 0.075, theme.id === 'snow' ? '#83a7bf' : theme.id === 'desert' ? '#bd7257' : '#5b98a0', 55, camera.x);
    this.drawRidge(ctx, horizon + 47, 0.14, theme.id === 'snow' ? '#6489a6' : theme.id === 'desert' ? '#a85c47' : '#417a72', 77, camera.x);
    this.drawRidge(ctx, horizon + 84, 0.24, theme.id === 'volcano' ? '#2d2f40' : theme.id === 'storm' ? '#303e53' : '#315f58', 49, camera.x);

    const offset = -((camera.x * .34) % 180);
    ctx.save(); ctx.globalAlpha = .9;
    for (let x = offset - 180; x < this.width + 180; x += 180) {
      const y = horizon + 102 + Math.sin((x + camera.x * .34) * .02) * 10;
      if (theme.id === 'green' || theme.id === 'snow') this.drawTree(ctx, x + 44, y, theme);
      else if (theme.id === 'desert') this.drawCactus(ctx, x + 48, y + 9);
      else if (theme.id === 'volcano') this.drawEmberRock(ctx, x + 49, y + 9);
      else this.drawStormPylon(ctx, x + 49, y + 7);
    }
    ctx.restore();

    if (theme.id === 'storm') this.drawRain(ctx, camera.x);
    if (theme.id === 'snow') this.drawSnow(ctx, camera.x);
    if (theme.id === 'volcano') this.drawAsh(ctx, camera.x);
  }

  drawRidge(ctx, y, speed, fill, height, cameraX) {
    const offset = -((cameraX * speed) % 260) - 260;
    ctx.save(); ctx.fillStyle = fill; ctx.globalAlpha = .54;
    ctx.beginPath(); ctx.moveTo(0, this.height);
    for (let x = offset; x < this.width + 300; x += 52) {
      const world = x + cameraX * speed;
      const peak = y - height * (.35 + .65 * Math.abs(Math.sin(world * .009 + 1.7)));
      ctx.lineTo(x, peak); ctx.lineTo(x + 26, y + 5);
    }
    ctx.lineTo(this.width, this.height); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  drawTree(ctx, x, y, theme) {
    ctx.save(); ctx.translate(x, y); const scale = theme.id === 'snow' ? .9 : 1;
    ctx.fillStyle = '#493b35'; ctx.fillRect(-3 * scale, -33 * scale, 6 * scale, 34 * scale);
    ctx.fillStyle = theme.id === 'snow' ? '#d8f4f5' : '#286349';
    ctx.beginPath(); ctx.moveTo(0, -72 * scale); ctx.lineTo(-25 * scale, -31 * scale); ctx.lineTo(-12 * scale, -32 * scale); ctx.lineTo(-28 * scale, -7 * scale); ctx.lineTo(0, -17 * scale); ctx.lineTo(27 * scale, -7 * scale); ctx.lineTo(12 * scale, -32 * scale); ctx.lineTo(25 * scale, -31 * scale); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  drawCactus(ctx, x, y) { ctx.save(); ctx.translate(x,y); ctx.strokeStyle='#4b7656'; ctx.lineWidth=7; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(0,0);ctx.lineTo(0,-47);ctx.moveTo(0,-28);ctx.lineTo(-15,-37);ctx.lineTo(-15,-47);ctx.moveTo(0,-17);ctx.lineTo(16,-25);ctx.lineTo(16,-34);ctx.stroke();ctx.restore(); }
  drawEmberRock(ctx,x,y) { ctx.save();ctx.translate(x,y);ctx.fillStyle='#392d36';ctx.beginPath();ctx.moveTo(-25,0);ctx.lineTo(-14,-19);ctx.lineTo(2,-13);ctx.lineTo(16,-27);ctx.lineTo(28,0);ctx.closePath();ctx.fill();ctx.fillStyle='#ed693d';ctx.shadowColor='#ff9648';ctx.shadowBlur=10;ctx.fillRect(-1,-15,4,12);ctx.restore(); }
  drawStormPylon(ctx,x,y) { ctx.save();ctx.translate(x,y);ctx.strokeStyle='#26384e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(0,-45);ctx.lineTo(12,0);ctx.moveTo(-7,-24);ctx.lineTo(7,-24);ctx.stroke();ctx.fillStyle='#9bd7db';ctx.fillRect(-2,-47,4,4);ctx.restore(); }
  drawRain(ctx, camera) { ctx.save();ctx.globalAlpha=.23;ctx.strokeStyle='#b6e0f0';ctx.lineWidth=1;const shift=-(camera*.5%28);for(let x=shift-30;x<this.width+30;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-18,this.height*.55);ctx.stroke();}ctx.restore(); }
  drawSnow(ctx, camera) { ctx.save();ctx.globalAlpha=.55;ctx.fillStyle='#ffffff';const shift=-(camera*.25%42);for(let x=shift;x<this.width+42;x+=42){const y=70+((x*17)%160);ctx.beginPath();ctx.arc(x,y,2.1,0,Math.PI*2);ctx.fill();}ctx.restore(); }
  drawAsh(ctx, camera) { ctx.save();ctx.globalAlpha=.45;ctx.fillStyle='#ffd07a';const shift=-(camera*.2%70);for(let x=shift;x<this.width+70;x+=70){const y=80+((x*13)%170);ctx.fillRect(x,y,2,5);}ctx.restore(); }

  drawWorldDecor(ctx, game, theme, project) {
    const min = game.camera.x - 120, max = game.camera.x + this.width + 120;
    // Small world objects use terrain sprite regions at only a few authored locations,
    // keeping the background modular rather than painting the whole sheet every frame.
    const start = Math.floor(min / 520) * 520;
    for (let x = start; x < max; x += 520) {
      const y = this.terrain.heightAt(x + 70);
      if (y === null) continue;
      const p = project(x + 70, y + 8);
      if (theme.id === 'green' && Math.floor(x / 520) % 3 === 0) this.drawRock(ctx, p.x, p.y - 12, '#43605a');
      if (theme.id === 'desert') this.drawCactus(ctx, p.x, p.y + 8);
      if (theme.id === 'snow' && Math.floor(x / 520) % 2 === 0) this.drawSnowRock(ctx, p.x, p.y + 4);
      if (theme.id === 'volcano') this.drawEmberRock(ctx, p.x, p.y + 4);
    }
    if (game.gravityMode !== 'normal' && !game.rewinding) {
      const p = project(game.player.x + 115, (this.terrain.heightAt(game.player.x + 115) || 180) + 45);
      ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = game.gravityMode === 'reverse' ? '#ff6e96' : '#b78aff'; ctx.lineWidth = 2; ctx.setLineDash([3,7]); ctx.beginPath(); ctx.arc(p.x,p.y,35+Math.sin(game.time*7)*4,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }
  drawRock(ctx,x,y,color) { ctx.save();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-20,y+10);ctx.lineTo(x-12,y-9);ctx.lineTo(x+3,y-16);ctx.lineTo(x+19,y+10);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(255,255,255,.13)';ctx.beginPath();ctx.moveTo(x-11,y-7);ctx.lineTo(x+2,y-13);ctx.lineTo(x+1,y-2);ctx.closePath();ctx.fill();ctx.restore(); }
  drawSnowRock(ctx,x,y) { this.drawRock(ctx,x,y,'#accbd7'); }

  drawCollectibles(ctx, game, project) {
    for (const item of game.collectibles) {
      if (game.collected.has(item.id)) continue;
      if (item.x < game.camera.x - 90 || item.x > game.camera.x + this.width + 90) continue;
      const p = project(item.x, item.y + Math.sin(game.time * 3 + item.phase) * 4);
      const spriteSheet = item.sheet || 'collectibles';
      const region = item.sprite;
      ctx.save(); ctx.globalAlpha = .26; ctx.fillStyle = item.kind === 'gem' ? '#88d9ff' : item.kind === 'fuel' ? '#ff6b61' : '#ffe26a'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(p.x,p.y,16+Math.sin(game.time*4+item.phase)*2,0,Math.PI*2);ctx.fill();ctx.restore();
      this.assets.draw(ctx, spriteSheet, SPRITES[spriteSheet][region] || region, p.x, p.y, item.kind === 'power' ? 39 : 31, item.kind === 'power' ? 39 : 36, Math.sin(game.time * 1.6 + item.phase) * .06, .97);
    }
  }

  drawFloaters(ctx, game, project) {
    for (const floater of game.floatingTexts || []) {
      const p = project(floater.x, floater.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
      ctx.fillStyle = floater.color;
      ctx.font = '800 18px "Arial Narrow", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = floater.color;
      ctx.shadowBlur = 10;
      ctx.fillText(floater.text, p.x, p.y);
      ctx.restore();
    }
  }

  drawGravityEffects(ctx, game, project) {
    if (game.gravityPulse > 0) {
      const p = project(game.player.x, game.player.y);
      const amount = 1 - game.gravityPulse / 1.2;
      ctx.save(); ctx.globalAlpha = Math.min(.5, game.gravityPulse * .65); ctx.strokeStyle = game.gravityMode === 'reverse' ? '#ff5d9a' : '#bd8aff'; ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 25;
      for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.arc(p.x, p.y, 30 + amount * 160 + i * 17, 0, Math.PI * 2); ctx.stroke(); } ctx.restore();
      this.assets.draw(ctx, 'gravity', game.gravityMode === 'reverse' ? 'redFlip' : 'purplePortal', p.x, p.y, 92, 92, game.time * (game.gravityMode === 'reverse' ? -1 : 1), .65);
    }
  }

  drawPreviewRig(ctx, game, project) {
    game.previewPlayer.configure(game.save.selectedCar);
    const x = game.camera.x + this.width * .5;
    const y = 200 + Math.sin(game.time * 1.8) * 3;
    const p = project(x, y);
    game.previewPlayer.x = x; game.previewPlayer.y = y; game.previewPlayer.angle = Math.sin(game.time * 1.2) * .035;
    game.previewPlayer.draw(ctx, this.assets, project, this.terrain.themeAt(x), 'normal', this.settings.reducedMotion);
  }

  drawForegroundAtmosphere(ctx, game, theme, preview) {
    const gradient = ctx.createLinearGradient(0, this.height * .6, 0, this.height);
    gradient.addColorStop(0, 'rgba(4,18,24,0)'); gradient.addColorStop(1, theme.id === 'volcano' ? 'rgba(21,5,12,.28)' : 'rgba(3,19,25,.2)');
    ctx.fillStyle = gradient; ctx.fillRect(0, this.height * .56, this.width, this.height * .44);
    if (!preview && game.flash > 0) { ctx.save(); ctx.globalAlpha = game.flash * .22; ctx.fillStyle = game.flashColor || '#ffffff'; ctx.fillRect(0,0,this.width,this.height); ctx.restore(); }
  }
}
