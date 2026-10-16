# Soundstage

Five-stage, 2.5D musical platforming campaign with a Three.js presentation. Land on instruments in the displayed phrase order to build a note chain. Successful chains increase movement speed, capped at 9.88 units/second. A completed phrase adds score. Missing a phrase or the chain window removes the boost, never campaign progress.

## Controls and progression

A/D or arrows move; Space jumps; Escape pauses. Touch buttons provide the same controls. Drum pads bounce automatically. Bonus notes reward jumping. Every sixth pad is a checkpoint. Falls retain visited instruments and collected bonuses, preventing score farming. Completion unlocks the next stage. Best score and best time persist separately in localStorage under `nexus-soundstage-campaign-v1`. Volume includes mute at zero; chain assist changes the window from four to eight seconds. Reduced motion removes player lean and collectible spinning and uses a direct-follow camera. Audio starts after an explicit Play interaction.

## Architecture

- `source/src/core.mjs`: deterministic bounded movement, collision, notes, campaign and save validation.
- `source/src/authoring.mjs`: real NexusEngine Authoring `mesh.cube` operation; converts its source mesh into a portable triangle array.
- `source/src/app.mjs`: Three rendering, procedural instrument instances, Web Audio voices, controls and UI.
- `source/tests/core.test.mjs`: 13 headless tests, including a scripted traversal of all five stages.

Engine is pinned to `447816ea39e89fa7095b7a1ffdf46d8fba7f68cd`. Authoring owns the source cube; game-local rules own platform motion and musical state. No Nexus physics solver or unproven optional Kit is claimed. Three.js 0.165.0 (MIT) and NexusEngine (MIT) load through immutable/versioned jsDelivr URLs. The installer verifies game payload bytes; these external runtime imports are not bundled or covered by its payload hashes. An online connection is required.

## Verification

`node --test games/soundstage/source/tests/core.test.mjs`

Parent audit on 2026-10-16: 13/13 headless logic tests passed; JavaScript syntax check passed. The scripted traversal proves bounded logic reachability, not human difficulty or render quality. Browser rendering, actual CDN module loading, audio playback and real installer launch are not verified. This is a prototype, not a certified release.

`build/` is a byte-identical copy of the browser-ready source payload, following this repository's copy-based packaging convention. No compiler or GitHub CI was used. No repository was cloned or pulled. Public distribution uses the existing NexusArcade installer on the Luminary Labs website; Games GitHub Pages is not required.

Known limits: fixed authored stage sequences, side-on movement in a 3D scene, no gamepad profile, no mid-stage persisted checkpoint, and no branching campaign. Pause freezes the simulation. Save failures surface in the campaign panel and retain in-memory progression.
