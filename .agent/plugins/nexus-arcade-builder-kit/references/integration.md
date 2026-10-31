# Candidate integration and release

The Games repository owns content; NexusArcade owns the player/installer. Each game uses source/, build/ and install/game.json. Metadata owns the permanent NXA ID. Do not fabricate an IDEA relationship or allocate an ID concurrently with another integrator.

Global sync:builds deletes/recreates local build directories. build:site may retrieve immutable external sources. Inspect commands before use and preserve unrelated artifacts. Packaging dependencies are not automatically runtime network dependencies.

Before an authorized push, inspect the complete diff and re-read remote head. Use non-forced, expected-head-protected integration. Verify resulting commit/file content. Stop and reconcile a stale head rather than overwriting another worker.

Registry source payload, registry commit and current HEAD may intentionally differ. Candidate source can be committed with registryPending without promoting source-lock, ref-lock or latest. Public release requires reviewed immutable payload bytes, correct manifests/hashes, exact promotion authority and actual installer/player verification. Follow current repository distribution documentation; do not restore stale Pages or CI publication paths.
