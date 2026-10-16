# Last Call Café

A five-minute café prototype. Read the next ticket, prepare its recipe with keyboard or station buttons, and serve before patience expires. Missed guests cost energy; minute breaks offer three counter upgrades. Best scores and served counts persist locally.

## Run and test
Serve `build/` with a local HTTP server, or install from the Luminary Labs Arcade catalogue after registry publication. Run `node --test source/tests/*.mjs` for deterministic state checks. No GitHub CI or game Pages deployment is required.

## Layout
- `source/src/core.mjs`: queue, recipe, patience, upgrades, scoring and save validation.
- `source/src/app.mjs`: Canvas café illustration, ticket UI, keyboard/touch input and lifecycle.
- `source/src/engine-runtime.mjs`: pinned NexusEngine runtime bundle. Real Authoring cube vertices/faces supply the espresso-machine illustration.
- `source/THIRD-PARTY-LICENSES.txt`: runtime notices.
- `build/`: byte-identical distributable source copy, including dependencies.
- `install/game.json`: runtime ID NXA-000015 and catalogue metadata.

The parent review fixed an uninitialized Start path. An explicit visual fallback is shown if Authoring cannot initialize. Browser rendering and human playtest remain pending; DOM stand-in tests are not visual proof. This is a prototype, not a completed commercial game.


## Runtime repair audit, 2026-10-16
Runtime dependencies are now bundled and integrity-verified as part of the installed payload. See `docs/prototype-runtime-provenance.md` at the repository root. The real bundled Authoring API and pinned BrowserInstaller were exercised in Node; the latter used CacheStorage/service-worker stand-ins. Browser rendering, browser lifecycle and human playability still require review. Source/build copies match. No Chrome, repository clone/pull, or GitHub CI was used for this pass.
