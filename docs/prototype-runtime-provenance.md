# Self-contained prototype runtime repair — 2026-10-16

## Why
The prior Soundstage/Salvage import maps required hundreds of Engine modules. A real module-graph check hit jsDelivr's "Package size exceeded the configured limit of 50 MB" error. Merely checking top-level URLs missed this. Salvage also passed an array to `mesh.cube.size`, which the real API rejects. It now authors a unit cube and applies renderer dimensions separately.

## Pinned sources
- NexusEngine: `LuminaryLabs-Dev/NexusEngine@447816ea39e89fa7095b7a1ffdf46d8fba7f68cd`, MIT.
- Engine bridge exports actual `createEngine` plus a helper composing the actual Authoring contract, project and mesh kits. It is not the whole Authoring domain and supplies no physics solver.
- Three.js: 0.165.0 for Soundstage, 0.180.0 for Salvage, MIT.
- esbuild: 0.25.12, browser ESM target ES2022, minified. Dependency module texts were read from pinned official sources, kept in build memory and bundled. No repository was cloned or pulled.
- `prototype-engine-source-hashes.json` records module URL, input byte count and SHA-256.
- Every game carries third-party notices. No runtime network imports are needed after its payload is installed.

## Rebuild
Install esbuild 0.25.12 in an isolated development environment, then run `node scripts/build-prototype-runtime.mjs` with esbuild resolvable by Node. It writes `runtime-dist/`, not live game files. Copy the engine bridge into a reviewed game's `source/src/engine-runtime.mjs`, the appropriate Three bundle to `source/src/three-runtime.mjs`, and license text to `source/THIRD-PARTY-LICENSES.txt`. Mirror source to build, regenerate file hashes and publish a new immutable registry pointer. Never overwrite an existing installed version's bytes without incrementing its version.

## Evidence and limits
- 46 Node tests passed across four games and website session cache tests.
- Soundstage and Salvage execute the real bundled Authoring API; the rectangular-prop regression is covered.
- Soundstage simulated control traversal reaches all five finishes. Rooftop simulated control traversal rescues and delivers all ten people without teleporting, preserving fuel and hull.
- Café and Rooftop boot/Start handlers run through 120 simulated frames with real Authoring and DOM/Canvas stand-ins. This caught and fixed Café's uninitialized Start path.
- The actual pinned NexusArcade BrowserInstaller (`c7d1ac67063c9950d59a09c51d1cb068c1028652`) verifies bytes/hashes, commits and serves each of the four payloads in a CacheStorage/service-worker stand-in.
- No Chrome, actual browser render, audio playback, hardware or human playtest was performed. All four remain prototypes needing review.

Luna drafted Café/Rooftop and parent corrected/reviewed them. Luna stopped at its preview limit; Story Siege has only a partial local core draft, and Burrow Rescue is not implemented. Neither is registered or represented as complete.
