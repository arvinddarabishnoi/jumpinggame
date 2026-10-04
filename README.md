# Gravity Run

A browser-playable 2D physics car adventure built for the `jumpinggame` repository.

## Implemented

- HTML5 Canvas + vanilla JavaScript
- Physics-driven car: acceleration, braking, slope response, air rotation and landing impact
- Coins, fuel, nitro, gravity flip and limited rewind
- Stunt detection, flips and combo scoring
- Semi-procedural, progressively harder terrain
- Smooth camera follow and parallax background
- World progression: Green Hills → Desert → Snow → Storm → Volcano → Alien
- Crash/damage feedback, landing effects and particles
- Garage upgrades with real gameplay modifiers
- Missions, records and `localStorage` persistence
- Keyboard and touch controls
- Existing category asset sheets are loaded with a runtime crop/extraction pass; vector fallback keeps gameplay usable if a sheet cannot be isolated cleanly

## Controls

`D` / `Right Arrow` accelerate · `A` / `Left Arrow` brake/reverse · `W` / `Up Arrow` and `S` / `Down Arrow` air rotation · `Space` nitro · `G` gravity flip · `R` rewind · `Esc` pause.

## Run

Open `index.html` in a modern browser or serve the repo through any static web server. No external runtime dependency is required.
