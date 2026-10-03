/* input.js — keyboard, touch buttons and pause/menu keys
 * ------------------------------------------------------------------
 * Everything is exposed as actions ("left", "jump", …) so the rest of the
 * game never looks at raw key codes.
 */

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyJ: 'jump',
  KeyX: 'attack', KeyK: 'attack', ShiftLeft: 'attack', ShiftRight: 'attack',
  Enter: 'start', NumpadEnter: 'start',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute', KeyR: 'restart',
  KeyF: 'debug',
  Digit1: 'lvl1', Digit2: 'lvl2', Digit3: 'lvl3',
};

export class Input {
  constructor(target = window) {
    this.down = Object.create(null);
    this.was = Object.create(null);
    this.touchDown = Object.create(null);
    this.anyKeySince = -1;
    this.time = 0;

    target.addEventListener('keydown', e => {
      const a = KEYS[e.code];
      if (!a) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.down[a] = true;
      this.anyKeySince = this.time;
    });
    target.addEventListener('keyup', e => {
      const a = KEYS[e.code];
      if (a) this.down[a] = false;
    });
    target.addEventListener('blur', () => { for (const k in this.down) this.down[k] = false; });

    // tapping or clicking the play area confirms menus (and unlocks audio)
    const stage = document.getElementById('stage') || document.body;
    stage.addEventListener('pointerdown', e => {
      if (e.target.closest && e.target.closest('.btn')) return;
      this.touchDown.start = true;          // confirm menus; never a stray jump
      setTimeout(() => { this.touchDown.start = false; }, 90);
    });

    // --- on-screen buttons (phones / tablets) --------------------------
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch');
    }
    document.querySelectorAll('#touch .btn').forEach(btn => {
      const a = btn.dataset.key;
      const on = e => { e.preventDefault(); this.touchDown[a] = true; btn.classList.add('on'); };
      const off = e => { e.preventDefault(); this.touchDown[a] = false; btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
  }

  /** Snapshot the button state.  Call this at the *end* of every frame,
   *  after the game has read isDown()/justPressed(). */
  update(dt) {
    this.time += dt;
    for (const k in this.down) this.was[k] = this.down[k] || this.touchDown[k];
    for (const k in this.touchDown) this.was[k] = this.down[k] || this.touchDown[k];
  }

  isDown(a) { return !!(this.down[a] || this.touchDown[a]); }
  justPressed(a) { return !!(this.down[a] || this.touchDown[a]) && !this.was[a]; }
  /** any of the "confirm" actions pressed */
  confirmPressed() {
    return this.justPressed('jump') || this.justPressed('start') || this.justPressed('attack');
  }
  pressedLevel() {
    for (let i = 1; i <= 3; i++) if (this.justPressed('lvl' + i)) return i - 1;
    return -1;
  }
}
