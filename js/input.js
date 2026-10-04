const KEY_ACTIONS = {
  ArrowRight: 'accelerate',
  d: 'accelerate',
  D: 'accelerate',
  ArrowLeft: 'reverse',
  a: 'reverse',
  A: 'reverse',
  ArrowUp: 'airFront',
  w: 'airFront',
  W: 'airFront',
  ArrowDown: 'airBack',
  s: 'airBack',
  S: 'airBack',
  ' ': 'nitro',
  Spacebar: 'nitro',
  g: 'gravity',
  G: 'gravity',
  r: 'rewind',
  R: 'rewind',
  Escape: 'pause'
};

export class InputManager {
  constructor(root = document) {
    this.down = new Set();
    this.pressed = new Set();
    this.root = root;
    this.onPress = null;
    this.touchButtons = [];
    this.bindKeyboard();
    this.bindTouch();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      const action = KEY_ACTIONS[event.key];
      if (!action) return;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
      const firstPress = !this.down.has(action);
      if (firstPress) this.pressed.add(action);
      this.down.add(action);
      if (firstPress) this.onPress?.(action);
    }, { passive: false });
    window.addEventListener('keyup', (event) => {
      const action = KEY_ACTIONS[event.key];
      if (action) this.down.delete(action);
    });
    window.addEventListener('blur', () => { this.down.clear(); });
  }

  bindTouch() {
    this.root.querySelectorAll('[data-action]').forEach((button) => {
      const action = button.dataset.action;
      if (!['accelerate', 'reverse', 'nitro', 'gravity', 'rewind', 'airFront', 'airBack'].includes(action)) return;
      const press = (event) => {
        event.preventDefault();
        button.classList.add('active');
        this.down.add(action);
        this.pressed.add(action);
        this.onPress?.(action);
        try { button.setPointerCapture?.(event.pointerId); } catch {}
      };
      const release = (event) => {
        event.preventDefault();
        button.classList.remove('active');
        this.down.delete(action);
      };
      button.addEventListener('pointerdown', press, { passive: false });
      button.addEventListener('pointerup', release, { passive: false });
      button.addEventListener('pointercancel', release, { passive: false });
      button.addEventListener('pointerleave', (event) => { if (event.buttons === 0) release(event); }, { passive: false });
      this.touchButtons.push(button);
    });
  }

  isDown(action) { return this.down.has(action); }
  wasPressed(action) { return this.pressed.has(action); }
  consume(action) { const value = this.pressed.has(action); this.pressed.delete(action); return value; }
  press(action) { this.pressed.add(action); this.onPress?.(action); }
  endFrame() { this.pressed.clear(); }
  clear() { this.down.clear(); this.pressed.clear(); this.touchButtons.forEach((b) => b.classList.remove('active')); }
}
