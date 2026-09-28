# Arboria: Planet of Roots

`NXA-000012` is a five-minute restoration-strategy prototype for Nexus Arcade.

## Loop

Start with three connected land cells and 120 Sun Energy. Rotate Arboria, claim adjacent frontier cells, plant four tree species, water local groves, and spend energy on an 18-second global rainstorm. Six missions reward expansion and restoration. A run ends at five minutes or immediately when all six missions are completed.

The source concept came from a Gemini-generated browser game. The prototype is a clean-room conversion: the original is treated as behavior and visual reference, while the shipped runtime is deterministic, self-contained, and does not preserve the original monolithic `gameState`/Three.js authority model.

## Authoritative state

`src/core.mjs` owns all gameplay truth:

- deterministic 642-cell icosphere topology and adjacency;
- land/water classification and three-cell starting territory;
- territory claims and their Sun Energy cost;
- tree species, placement, hydration, growth and recurring energy yield;
- restoration per claimed land cell and derived planet vitality;
- timed rain weather state;
- six mission milestones and +80 energy rewards;
- five-minute session lifecycle, score and result reason;
- reset/replay state and record values.

`src/view.mjs` is presentation only. It projects the authoritative cell/tree snapshot into a rotatable 2D canvas globe, draws restoration color, trees, stars and rain, and never determines gameplay outcomes.

## Score

The Restoration Score is derived from authoritative state: claimed territory, established trees, vitality, completed missions, species diversity, plus an early-mastery time bonus.

## Controls

- Joystick / Arrow keys / WASD: rotate the planet and move the centered target.
- A / Enter / Space: context action — claim a locked adjacent cell or plant the selected species on free land.
- B: cycle species.
- X: water the target cell.
- Y: call rain (50 Sun Energy).
- Escape / Start: pause/resume.
- Mouse: drag to rotate, click to target, wheel to zoom.
- Number keys 1–4: direct species selection.

## Validation

`tests/arboria-planet-of-roots.test.mjs` proves deterministic topology, starting state, claim/plant/water/rain rules, mission reward behavior, tree-yield cadence, reset/replay, timeout, and a deterministic strategy reaching mastery within the five-minute window.

The browser surface exposes `window.Arboria` only as a thin test/automation facade over the same runtime (`start`, `restart`, `pause`, `select`, `action`, `advance`, `snapshot`). It does not maintain duplicate gameplay state.

## Packaging

The prototype has no runtime CDN dependency and uses system fonts plus local HTML/CSS/ES modules. `cover.svg` is local. No deployment or registry configuration is owned by this game folder.
