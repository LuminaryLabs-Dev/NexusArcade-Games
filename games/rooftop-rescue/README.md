# Rooftop Rescue

An arcade rescue-flight game about balancing powered climb, gliding, fuel, passenger load, and safe landings. Fly to one of five rooftops, hold Rescue to bring people aboard, then return to the marked evacuation pad to deliver them and service the aircraft.

## Structure

- `source/` contains the editable game and headless core tests.
- `build/` contains the same launchable runtime payload plus the bundled NexusEngine runtime and third-party licenses.
- `install/game.json` reserves NXA-000016; registry publication follows parent review.

## Controls

- A/D or arrow keys: horizontal flight
- W/Up: powered climb (uses fuel)
- S/Down: descend
- Hold E: rescue while landed at a rooftop
- Escape: pause
- Touch: hold the on-screen flight controls

The rescue-flight simulation in `source/src/core.mjs` is deterministic and game-owned. NexusEngine Authoring creates the aircraft-hull cube; the Canvas renderer projects its returned vertices and faces into the flight scene. If the local Engine runtime fails to load, an explicit fallback hull remains visible and the flight game stays playable.


## Runtime repair audit, 2026-10-16
Runtime dependencies are now bundled and integrity-verified as part of the installed payload. See `docs/prototype-runtime-provenance.md` at the repository root. The real bundled Authoring API and pinned BrowserInstaller were exercised in Node; the latter used CacheStorage/service-worker stand-ins. Browser rendering, browser lifecycle and human playability still require review. Source/build copies match. No Chrome, repository clone/pull, or GitHub CI was used for this pass.
