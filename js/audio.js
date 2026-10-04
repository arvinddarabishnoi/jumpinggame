export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.lastEngine = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = .22;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  tone(frequency, duration = .09, type = 'sine', volume = .08, slide = 0) {
    if (!this.settings.sound) return;
    this.init();
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + .02);
  }

  event(name) {
    if (!this.settings.sound) return;
    const patterns = {
      click: [[230, .05, 'square', .035, 70]],
      coin: [[620, .06, 'triangle', .07, 90], [820, .09, 'triangle', .055, 0]],
      fuel: [[260, .07, 'sine', .07, 110], [420, .12, 'sine', .06, 150]],
      energy: [[330, .08, 'sine', .06, 210], [650, .14, 'sine', .055, 0]],
      jump: [[210, .11, 'sine', .05, 120]],
      landing: [[110, .08, 'triangle', .06, -30]],
      stunt: [[360, .08, 'triangle', .06, 100], [540, .1, 'triangle', .06, 120], [760, .15, 'triangle', .06, 0]],
      gravity: [[180, .11, 'sawtooth', .045, 260], [480, .23, 'sine', .07, -80]],
      rewind: [[700, .18, 'sine', .05, -500]],
      nitro: [[95, .1, 'sawtooth', .06, 220]],
      crash: [[90, .17, 'sawtooth', .08, -45], [55, .22, 'square', .04, 0]],
      complete: [[440, .1, 'triangle', .07, 130], [660, .12, 'triangle', .07, 170], [880, .18, 'triangle', .06, 0]],
      gameover: [[210, .16, 'sawtooth', .06, -100], [120, .3, 'sawtooth', .05, -40]]
    };
    (patterns[name] || patterns.click).forEach((p, index) => setTimeout(() => this.tone(...p), index * 65));
  }

  engine(speed, throttle) {
    if (!this.settings.sound) return;
    this.init();
    if (!this.ctx || !this.master || this.ctx.currentTime - this.lastEngine < .045) return;
    this.lastEngine = this.ctx.currentTime;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.connect(this.engineGain).connect(this.master);
      this.engineGain.gain.value = .0001;
      this.engineOsc.start();
    }
    const now = this.ctx.currentTime;
    const target = .0001 + Math.min(.045, Math.abs(speed) / 2600 + (throttle ? .012 : 0));
    this.engineGain.gain.setTargetAtTime(target, now, .05);
    this.engineOsc.frequency.setTargetAtTime(70 + Math.min(190, Math.abs(speed) * .18) + (throttle ? 35 : 0), now, .04);
  }

  stopEngine() {
    if (this.engineGain && this.ctx) this.engineGain.gain.setTargetAtTime(.0001, this.ctx.currentTime, .04);
  }
}
