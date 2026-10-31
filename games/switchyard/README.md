# Switchyard

NXA-000017 · version0.1.0 · prototype · registry promotion pending

Dispatch miniature trains through two entrances, one shared merge, three switches and four stations. Preserve a route after its train commits and wait for the rear carriage to clear before changing it. The supplied ten-wave Standard Shift, tutorial, unlockable Endless Yard, emergency braking, turbo whistle, streak/fever/close-call feedback, settings and procedural railway presentation remain game-owned.

## Run and test

Serve `build/` over local HTTP, then open its `index.html`. It is a multi-file ES-module payload; do not launch by double-clicking a `file:` URL. Runtime assets, Engine bundle and sound synthesis are local; there are no runtime CDN requests.

From repository root:

```sh
node --test tests/switchyard.test.mjs tests/switchyard-campaign.test.mjs
npm test
```

The repository's separate `node tests/browser-smoke.mjs` now includes Switchyard. It requires a working Chromium installation and local socket access. Its addition is not evidence that it ran.

Optional DOM/native-Canvas checks (not browser acceptance):

```sh
cd games/switchyard/tooling
npm ci
npm run test:host
```

The tooling dependencies are locked and are never shipped in the game payload. `host-check.mjs` can take an evidence-directory argument. It uses DOM emulation and a native Canvas adapter, not Chromium or a real touch device.

To refresh this game's payload after editing, copy this game's `source/` contents into its `build/` directory. The global `sync:builds` command rewrites all local games, so use it only in an isolated checkout after preserving other work.

## Engine ownership and pin

The local bundle is generated from NexusEngine public exports at commit `4906076837d4020ff2e22fe98723e0922ea6af62` (package0.0.4), using esbuild0.25.12. `source/vendor/provenance.json` records its SHA-256 and public exports. The MIT notice is retained in the payload.

| Responsibility | Owner and decision | Evidence |
| --- | --- | --- |
| Fixed tick, phase ordering, commits | REUSE Nexus `createEngine`, Runtime Lifecycle and Realtime Kits | `src/runtime.mjs`; command ordering and committed tick tests |
| Semantic switch/signal/brake/turbo input | ADAPT host actions into Engine `defineEvent` queue | bounded64-entry queue, one dispatch per fixed tick, nested actions apply in the same tick |
| Train membership and read-only observation | REUSE Engine entities, `defineComponent`, `defineResource` | TrainView/YardState; restart/disposal membership tests |
| Rail curves, route commitment, occupancy, score and waves | KEEP GAME-SPECIFIC | `src/simulation.mjs`; all four destination tests and full ten-wave legal dispatch |
| Canvas renderer and authored scenery | KEEP GAME-SPECIFIC provider | `src/renderer.mjs`; empty-yard native-Canvas pixel comparison against the original |
| DOM, visibility, frame scheduling and audio | ADAPT disposable browser host | AbortController listeners, one RAF loop, explicit pause/resume, audio fallback |
| Browser storage | KEEP GAME-SPECIFIC adapter | validated defaults, legacy key retained, denied/corrupt storage tests |
| Sequence Kit | Engine default composition only | installed by `createEngine`; no claim that railway routing uses sequence graphs |

This is not a new Core domain and makes no NexusEngine repository changes. The simulation remains an authored class advanced by the Engine game Kit. TrainView and YardState are committed observations, not a second simulation. This candidate does not claim portable full-state snapshot/rollback, native mobile execution, or a generic railway Kit.

The vendored bundle can be reproduced from a clean checkout of the exact Engine pin:

```sh
cd games/switchyard/tooling
npm ci
npm run vendor -- /absolute/path/to/pinned/NexusEngine
```

The upstream pin produces an existing duplicate `publicEntries` key warning in `src/core-domains/world/domain.manifest.js`; this consumer does not modify it.

## Original and changes

The user supplied `Pasted text(20261031-222714).txt` on2026-10-31. The unmodified input is preserved in `reference/original.html`, SHA-256 `799c441d582a96df3d1176f15b9130e0b4c7ec271c4c4262b58c3dab20444611`. It contains generated HTML/CSS/JavaScript, procedural Canvas artwork and Web Audio synthesis, with no external asset imports. Origin is user-supplied generated code; this is provenance, not an independent copyright audit. The original is not part of `build/`.

The conversion splits configuration, simulation, rendering, audio, storage, UI and host/runtime ownership. Corrections include:

- Green signals no longer stop every train at the approach stop line.
- Held queues update actual traveled distance and do not append unbounded stationary trail samples.
- Junction reservations remain until the rear carriage clears; crashes release reservations only when removed.
- Segment transitions render against the current segment, not the previous curve.
- Repeated arrival/collision/completion calls do not duplicate scores or life penalties.
- Tutorial deliveries advance steps, recovery uses simulation time, and hiding/pausing cannot reset a later run.
- Tutorial merge practice uses a consistent destination and requires the player to hold/release the signal.
- Restarting a wave restores its score/lives/streak checkpoint rather than farming completed deliveries.
- Close-call bonuses require actual rear clearance, not merely a dangerous approach.
- All effects have bounded pools, settings reject malformed records, and disposal removes listeners and the frame loop.
- In-page checks run real isolated logic and no longer fabricate PASS for browser, input or visibility coverage or overwrite the player's records.

No shared Engine refactor or unrelated game edit is included.

## Candidate status and remaining gates

See `evidence/validation.json` for executed checks and limitations. The full repository test chain, focused simulation/campaign checks and DOM/native-Canvas checks passed in the recorded environment. Browser launch was blocked by sandbox socket permissions; the attempted elevated launch failed in environment setup. The separate Mac coding task failed before execution at its usage limit. No real-browser, physical-mobile, Web Audio listening, CSS layout or installer/player acceptance is claimed.

The existing Arcade standard's five-minute/upgrade structure is not silently substituted for the user's ten-wave dispatch game. That standard compatibility decision remains part of independent review. Keep `registryPending:true` until review, actual browser/device checks and explicit promotion authority are satisfied. No install manifest, public registry pointers, website deployment or release tag were generated or advanced in this conversion.

No exact Switchyard row was found in the active catalogue or current idea candidates at intake. Its repository ID is NXA-000017; an IDEA relationship remains unassigned rather than borrowing an unrelated idea's identity. The separate raw-idea batch owns its sheet writes and was not changed by this conversion.

Next action: run the browser smoke and interactive controls/tutorial/restart checks on the exact committed candidate, then obtain independent review and any standard-compatibility decision before publication.
