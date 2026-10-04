# Gravity//Run — Hillbound

A responsive Canvas 2D gravity-racing game built from the supplied high-quality asset sheets. The current vertical slice is fully playable: drive a physics-based rig across modular terrain, collect coins and fuel, spend nitro, flip gravity, land stunts, rewind mistakes, complete missions, and upgrade the car.

## Run it

Serve the repository over HTTP (ES modules and image loading need a local server):

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Then open `http://localhost:4173`.

## Controls

- **D / Right Arrow** — accelerate
- **A / Left Arrow** — brake / reverse
- **W / Up Arrow** — rotate forward in air
- **S / Down Arrow** — rotate backward in air
- **Space** — nitro
- **G** — cycle normal / low / reverse gravity
- **R** — rewind the latest few seconds
- **Esc** — pause

Mobile layouts expose large touch controls at the bottom of the playfield.

## Systems included

- Manual wheel/chassis physics with momentum, slope force, suspension contact, air rotation, landings, damage, fuel and nitro.
- Source-region sprite rendering from the supplied car, terrain, environment, gravity, collectible, power-up, UI, garage and mission sheets. The sheets are loaded as atlases; the runtime samples only the required regions.
- Controlled semi-procedural terrain with gaps, authored terrain texture regions, parallax background layers and changing world palettes: Green Hills, Ember Desert, Frostline, Storm Front and Volcanic Veil.
- Gravity core with low gravity, reverse gravity, energy, cooldown, pulse rings and particles.
- Collectibles, power-ups, stunt scoring, combo multiplier, perfect landings, fuel/energy strategy, crash states and pooled particles.
- Limited snapshot rewind restoring car physics, resources, score and collectible state.
- Main menu, modes, garage, car unlocks, measurable upgrades, mission board, supply depot, settings and local save data.
- Web Audio event architecture for future authored sounds plus lightweight synthesized feedback now.

## Structure

- `index.html` — screens, HUD, touch controls and overlays
- `styles.css` — responsive visual system
- `js/assets.js` — atlas paths and source regions
- `js/game.js` — run lifecycle, scoring, missions and rewind
- `js/player.js` — vehicle physics and rig rendering
- `js/terrain.js` — controlled terrain generation and collision surface
- `js/renderer.js` — Canvas world, parallax and effects
- `js/particles.js`, `js/audio.js`, `js/input.js`, `js/ui.js`, `js/save.js` — focused support systems
