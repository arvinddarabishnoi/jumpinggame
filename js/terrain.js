const THEMES = [
  { id: 'green', label: 'GREEN HILLS', start: 0, end: 3000, skyTop: '#75c4de', skyBottom: '#eaf5cf', ground: '#704f3b', grass: '#96d348', accent: '#dbf37a', cloud: '#f5ffff' },
  { id: 'desert', label: 'EMBER DESERT', start: 3000, end: 6200, skyTop: '#ef8c61', skyBottom: '#f8d384', ground: '#9a5634', grass: '#e4a44c', accent: '#ffe596', cloud: '#ffe0b0' },
  { id: 'snow', label: 'FROSTLINE', start: 6200, end: 9200, skyTop: '#547ea7', skyBottom: '#dcecf3', ground: '#536577', grass: '#d7f3ff', accent: '#f1ffff', cloud: '#f7ffff' },
  { id: 'storm', label: 'STORM FRONT', start: 9200, end: 12000, skyTop: '#172642', skyBottom: '#6a6484', ground: '#343c4d', grass: '#7695a5', accent: '#b9edec', cloud: '#8ca1b2' },
  { id: 'volcano', label: 'VOLCANIC VEIL', start: 12000, end: Infinity, skyTop: '#321b2b', skyBottom: '#c4573a', ground: '#4c3030', grass: '#e06938', accent: '#ffbc54', cloud: '#756168' }
];

function hash(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function smooth(a, b, t) { const k = t * t * (3 - 2 * t); return a + (b - a) * k; }

export class Terrain {
  constructor() {
    this.step = 145;
    this.nodes = [];
    this.seed = 17.31;
    this.generatedTo = -1;
    this.reset();
  }

  reset() {
    this.nodes = [{ x: -260, y: 154, gapBefore: false, profile: 'start' }];
    this.generatedTo = -260;
    this.ensureTo(16000);
  }

  ensureTo(maxX) {
    if (maxX <= this.generatedTo) return;
    let i = this.nodes.length - 1;
    let last = this.nodes[i];
    while (last.x < maxX) {
      i += 1;
      const x = last.x + this.step;
      const distance = Math.max(0, x);
      const band = Math.floor(distance / 1800);
      const waveA = Math.sin(i * .54 + this.seed) * (24 + Math.min(28, band * 5));
      const waveB = Math.sin(i * .19 + 1.4) * (18 + Math.min(24, band * 3));
      const noise = (hash(i * 1.71 + this.seed) - .5) * (16 + band * 3);
      let y = 158 + waveA + waveB + noise;
      if (x < 850) y = 162 + Math.sin(i * .54) * 19 + noise * .25;
      if (band === 1) y += Math.sin(i * .3) * 15;
      if (band === 2) y += Math.sin(i * .42) * 12;
      if (band >= 3) y += Math.sin(i * .25) * 24;
      y = Math.max(84, Math.min(258, y));
      const pattern = i % 16;
      const gapBefore = (pattern === 8 || pattern === 9) && x > 1060;
      const profile = gapBefore ? 'gap' : pattern === 3 ? 'crest' : pattern === 5 ? 'valley' : pattern === 12 ? 'ramp' : 'hill';
      if (profile === 'ramp') y += 22;
      if (profile === 'valley') y -= 19;
      last = { x, y, gapBefore, profile, variant: Math.floor(hash(i * 4.23) * 3) };
      this.nodes.push(last);
    }
    this.generatedTo = last.x;
  }

  themeAt(x) {
    const distance = Math.max(0, x);
    return THEMES.find((theme) => distance >= theme.start && distance < theme.end) || THEMES[THEMES.length - 1];
  }

  themes() { return THEMES; }

  transitionAt(x) {
    const theme = this.themeAt(x);
    const edge = [theme.start, theme.end].find((value) => Number.isFinite(value) && Math.abs(x - value) < 520);
    if (edge === undefined) return { current: theme, next: null, amount: 0 };
    const next = x < edge ? this.themeAt(edge + 1) : this.themeAt(edge + 1);
    const amount = Math.max(0, Math.min(1, 1 - Math.abs(x - edge) / 520));
    return { current: theme, next: next === theme ? null : next, amount };
  }

  nodePair(x) {
    this.ensureTo(x + this.step * 2);
    let hi = 1;
    while (hi < this.nodes.length && this.nodes[hi].x < x) hi += 1;
    const a = this.nodes[Math.max(0, hi - 1)];
    const b = this.nodes[Math.min(this.nodes.length - 1, hi)];
    return [a, b];
  }

  heightAt(x) {
    const [a, b] = this.nodePair(x);
    if (!a || !b || b.gapBefore) return null;
    const t = Math.max(0, Math.min(1, (x - a.x) / Math.max(1, b.x - a.x)));
    return smooth(a.y, b.y, t);
  }

  slopeAt(x) {
    const [a, b] = this.nodePair(x);
    if (!a || !b || b.gapBefore) return 0;
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  isGap(x) {
    return this.heightAt(x) === null;
  }

  visibleSegments(minX, maxX) {
    this.ensureTo(maxX + this.step);
    const output = [];
    for (let i = 1; i < this.nodes.length; i += 1) {
      const a = this.nodes[i - 1]; const b = this.nodes[i];
      if (b.x < minX || a.x > maxX) continue;
      output.push({ a, b, gap: b.gapBefore, theme: this.themeAt((a.x + b.x) / 2) });
    }
    return output;
  }

  draw(ctx, project, assets, minX, maxX, bottomY) {
    const segments = this.visibleSegments(minX, maxX);
    for (const segment of segments) {
      const { a, b, theme } = segment;
      const ax = project(a.x, 0).x; const bx = project(b.x, 0).x;
      if (segment.gap) {
        // A faint under-layer marks the safe-to-read landing shape without making the gap collidable.
        ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = theme.accent; ctx.setLineDash([6, 10]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ax, project(a.x, a.y - 2).y); ctx.lineTo(bx, project(b.x, b.y - 2).y); ctx.stroke(); ctx.restore();
        continue;
      }
      const ay = project(a.x, a.y).y; const by = project(b.x, b.y).y;
      const gradient = ctx.createLinearGradient(0, Math.min(ay, by), 0, bottomY);
      gradient.addColorStop(0, theme.grass);
      gradient.addColorStop(.055, theme.ground);
      gradient.addColorStop(1, this.darken(theme.ground, .5));
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, bottomY); ctx.lineTo(ax, bottomY); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = theme.accent; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay - 1); ctx.lineTo(bx, by - 1); ctx.stroke();
      ctx.strokeStyle = 'rgba(21,34,31,.21)'; ctx.lineWidth = 2;
      for (let mark = 0; mark < 3; mark += 1) {
        const tx = ax + (bx - ax) * ((mark + .2) / 3.2);
        const ty = ay + (by - ay) * ((mark + .2) / 3.2);
        ctx.beginPath(); ctx.moveTo(tx, ty + 24); ctx.lineTo(tx + 12, ty + 32); ctx.stroke();
      }
      const span = Math.abs(b.x - a.x);
      if (span > 100 && Math.floor(a.x / this.step) % 3 === 0 && assets) {
        const midX = (a.x + b.x) * .5;
        const midY = this.heightAt(midX);
        if (midY !== null) {
          const p = project(midX, midY - 20);
          const sprite = theme.id === 'snow' ? 'ice' : theme.id === 'desert' ? 'dirtFlat' : 'grassHill';
          const region = assets ? (sprite === 'ice' ? 'ice' : sprite === 'dirtFlat' ? 'dirtFlat' : 'grassHill') : null;
          assets.draw(ctx, 'terrain', region, p.x, p.y, Math.min(105, span * .72), sprite === 'grassHill' ? 62 : 42, -this.slopeAt(midX), .46);
        }
      }
    }
  }

  darken(hex, amount) {
    const value = hex.replace('#', '');
    const num = parseInt(value, 16);
    const r = Math.max(0, Math.floor((num >> 16) * amount));
    const g = Math.max(0, Math.floor(((num >> 8) & 255) * amount));
    const b = Math.max(0, Math.floor((num & 255) * amount));
    return `rgb(${r},${g},${b})`;
  }
}

export { THEMES };
