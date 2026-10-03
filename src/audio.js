/* audio.js — tiny WebAudio chiptune: synth sound effects + a looping song
 * ------------------------------------------------------------------
 * No audio files: every blip is generated at runtime, so the whole game is
 * just sprites + code.  Audio only starts after the player's first input
 * (browser autoplay rules).
 */

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const freq = (name) => {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const semi = NOTE[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (semi - 69) / 12);
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = 0;
    this.step = 0;
    this.started = false;
  }

  /** must be called from a user gesture */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
    this.started = true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // ---------------------------------------------------------------- voices
  tone(o = {}) {
    if (!this.ctx || this.muted) return;
    const { type = 'square', f0 = 440, f1 = f0, dur = 0.12, vol = 0.3,
            delay = 0, attack = 0.005, dest = this.sfxGain, curve = 'exp' } = o;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      else osc.frequency.linearRampToValueAtTime(Math.max(20, f1), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(o = {}) {
    if (!this.ctx || this.muted) return;
    const { dur = 0.12, vol = 0.3, delay = 0, f0 = 1800, f1 = 200, q = 1 } = o;
    const t = this.ctx.currentTime + delay;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  // ------------------------------------------------------------------ sfx
  jump()   { this.tone({ type: 'square', f0: 320, f1: 690, dur: 0.14, vol: 0.22 }); }
  double() { this.tone({ type: 'triangle', f0: 520, f1: 980, dur: 0.16, vol: 0.24 }); }
  land()   { this.noise({ dur: 0.09, vol: 0.18, f0: 900, f1: 120 }); }
  swing()  { this.noise({ dur: 0.16, vol: 0.22, f0: 5200, f1: 900, q: 3 });
             this.tone({ type: 'sawtooth', f0: 900, f1: 260, dur: 0.12, vol: 0.10 }); }
  hitEnemy() { this.noise({ dur: 0.13, vol: 0.3, f0: 2600, f1: 300 });
               this.tone({ type: 'square', f0: 220, f1: 90, dur: 0.14, vol: 0.24 }); }
  enemyDown() { this.noise({ dur: 0.3, vol: 0.26, f0: 1400, f1: 90 });
                this.tone({ type: 'triangle', f0: 180, f1: 60, dur: 0.3, vol: 0.2 }); }
  coin()   { this.tone({ type: 'square', f0: freq('B5'), dur: 0.07, vol: 0.2 });
             this.tone({ type: 'square', f0: freq('E6'), dur: 0.16, vol: 0.2, delay: 0.06 }); }
  heart()  { ['E5', 'G5', 'C6'].forEach((n, i) =>
               this.tone({ type: 'triangle', f0: freq(n), dur: 0.16, vol: 0.22, delay: i * 0.07 })); }
  hurt()   { this.tone({ type: 'sawtooth', f0: 420, f1: 110, dur: 0.3, vol: 0.26 });
             this.noise({ dur: 0.22, vol: 0.2, f0: 1200, f1: 200 }); }
  death()  { const seq = ['G4', 'F4', 'D4', 'A3'];
             seq.forEach((n, i) => this.tone({ type: 'square', f0: freq(n), dur: 0.26, vol: 0.24, delay: i * 0.15 })); }
  win()    { ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((n, i) =>
               this.tone({ type: 'square', f0: freq(n), dur: 0.2, vol: 0.24, delay: i * 0.11 })); }
  menu()   { this.tone({ type: 'square', f0: 660, f1: 880, dur: 0.09, vol: 0.18 }); }
  spike()  { this.tone({ type: 'sawtooth', f0: 160, f1: 60, dur: 0.2, vol: 0.24 }); }

  // ----------------------------------------------------------------- music
  /** one bar of the loop: [bass, lead] per 8th note, '·' = rest */
  music(dt) {
    if (!this.ctx || this.muted) return;
    const SPB = 60 / 132 / 2;                  // 8th note at 132 bpm
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer += SPB;
    const bass = ['C3', '·', 'C3', '·', 'A#2', '·', 'A#2', '·', 'G#2', '·', 'G#2', '·', 'G2', '·', 'G2', '·'];
    const lead = ['C5', 'D#5', 'G5', 'D#5', 'C5', 'G4', 'C5', 'D#5',
                  'A#4', 'D5', 'F5', 'D5', 'A#4', 'F4', 'A#4', 'D5',
                  'G#4', 'C5', 'D#5', 'C5', 'G#4', 'D#4', 'G#4', 'C5',
                  'G4', 'B4', 'D5', 'B4', 'G4', 'D4', 'G4', 'B4'];
    const s = this.step++;
    const b = bass[s % bass.length];
    const l = lead[s % lead.length];
    const D = this.musicGain;
    if (b !== '·') this.tone({ type: 'triangle', f0: freq(b), dur: SPB * 1.6, vol: 0.5, dest: D, attack: 0.01 });
    if (l !== '·') this.tone({ type: 'square', f0: freq(l), dur: SPB * 0.8, vol: 0.22, dest: D });
    if (s % 4 === 0) this.noise({ dur: 0.05, vol: 0.10, f0: 3000, f1: 800 });     // hat
    if (s % 8 === 0) this.tone({ type: 'sine', f0: 120, f1: 60, dur: 0.09, vol: 0.4 });   // kick
  }
}
