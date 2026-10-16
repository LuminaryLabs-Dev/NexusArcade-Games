# Salvage Workbench (task-local draft)

This is a runnable-source proposal for the first 3D stage: help a tiny rover cross a giant desk, swing the cable gap, retrieve the fan fuse, install it at a safe control point, and ride the repaired airflow to the battery. The stage includes one optional scrap pickup, checkpoint-preserving fall recovery, retry, a clear state, keyboard/pointer controls, reduced-motion styling, visual cues and optional synthesized audio.

## Files

- `source/index.html`: start screen, HUD, controls, accessibility styling and pinned import map.
- `source/engine-imports.json`: complete 449-alias mapping generated from the selected Engine package exports, plus Three.js; included because Engine source internally imports public semantic subpaths.
- `source/src/main.mjs`: game presentation and input; Three.js renders procedurally authored NexusEngine mesh documents.
- `source/src/stage-state.mjs`: pure stage reducer and bounded game-local movement/platform rules.
- `source/composition.json`: actual Engine composition and explicit implementation boundaries.
- `source/tests/stage-state.test.mjs`: authored, unexecuted state tests.
- `install/game.json`: proposed catalog metadata. The parent assigned `NXA-000013`; registration remains pending until the registry manifest is generated.
- `build/`: source payload copied into place to match this repository’s `sync:builds` behavior. This is not a compiler output and has not been run or validated.

## Verified domain composition

The runtime targets the immutable NexusEngine revision `447816ea39e89fa7095b7a1ffdf46d8fba7f68cd`, package version `0.0.4`:

- `n:authoring`: import `createAuthoringDomain` from the public `nexusengine/domains/authoring` subpath. Its 19-kit composition includes the project and mesh-document kits. The game uses the documented `project.execute({ requestId, epoch, operations: [{ id: 'mesh.cube', args: { id, size } }] })` operation and reads back `project.getDocument(id)`. It turns the portable source `vertices`/`faces` into Three.js geometry. This is real authoring output; Engine Authoring does not provide a renderer.
- `n:simulation`: import `createSimulationKit` from `nexusengine/domains/simulation`; the engine clock is advanced with `engine.tick(dt)`. Game progression remains an explicit game-local reducer.
- The import map uses the generated exact public subpath map at `source/engine-imports.json`; aliases are pinned to the same Engine commit. Do not trim this map to the two direct imports: Authoring’s mesh/geometry source imports additional bare `nexusengine/domains/spatial/...` subpaths.
- Rendering is a separate `three@0.180.0` dependency. Platform collision, gravity and tether movement are bounded, local game mechanics. No physics provider, collision kit, or Engine physics solver is claimed or used. No optional Kits or candidate kits are included.

The browser import map uses versioned jsDelivr URLs. NexusEngine’s npm package is not assumed to be published, and no runtime compatibility claim has been browser-verified.

## Source inspection record

Repository source was inspected through the GitHub connector only; no repository was cloned or pulled.

- `LuminaryLabs-Dev/NexusArcade-Games` branch `main` at `9f55ab5b7c5ddd4d9688ea8ebe71d1c0a7f5d4f0`.
- Root `README.md` blob `58fc63cf489d6606f35761fa4632a1b5795ddd34`.
- `games/README.md` blob `023f5ecb95f54af3029078700c03394d06415834`.
- `package.json` blob `07618ee1a2d4220467be45a537acb02fd01ec420`.
- `games/_template/source/index.html` blob `bd8d8d0320744e39d460c8d951849c243725d4af`.
- `games/_template/install/game.json` was checked for metadata shape.
- `games/arboria-planet-of-roots/install/game.json` blob `0d0be3b47f9e41fee944721b0e8a92b257d7b183`; confirms the existing `registryPending` pattern and ID `NXA-000012`.
- Inventory of all existing `games/*/install/game.json` files at the same main revision showed allocated IDs `NXA-000001` through `NXA-000012`. A search for `NXA-000013` had no result. The parent has since assigned `NXA-000013` for Salvage Workbench and `NXA-000014` for Soundstage in their planned atomic release.
- `LuminaryLabs-Dev/NexusEngine` immutable source revision `447816ea39e89fa7095b7a1ffdf46d8fba7f68cd`; inspected `AUTHORING.md`, `package.json`, `src/index.js`, `src/core-domains/authoring/index.js`, `src/core-domains/authoring/mesh/services.js`, `src/core-domains/simulation/index.js`, `src/core-domains/simulation/kits/simulation-kit/index.js`, and `src/core-domains/simulation/kits/simulation-kit/checkpoints.js`.
- NexusEngine current `main` inspected at `3efccc20f127380452cd1fb25fdba9d5164f7341` for release status only; implementation imports the immutable compatibility revision above, not mutable `main`.

## Release blockers and review checklist

- Keep `registryPending` until the parent promotes the install metadata and generates the installer’s immutable manifest/lock and file hashes using the approved registry workflow. None are fabricated here.
- Verify actual browser/CDN loading, WebGL support, controls and visual layout on the target website. Not performed in this draft.
- Review the first-stage pacing and ensure recovery/checkpoint semantics match the larger game plan.
- Tests are written but not executed. No app, test suite, build, browser, or CI workflow has been run.
