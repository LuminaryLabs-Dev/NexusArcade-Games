# Arcade prototype publication audit — 2026-10-16

Soundstage (NXA-000014) and Salvage Workbench (NXA-000013) were authored without cloning or pulling repositories. Soundstage was written by the coordinating agent; Salvage by a Luna worker, with parent review and corrections. Luna did not run the application or tests.

## Recorded evidence

- Source payload commit: b663d3be79c38a405aa4421fe254cc5006161c9a.
- Immutable registry commit: 2c1d116d5bdfc173fba5f6780aa422f9150a15ef.
- Registry promotion: b4b2f42ec6869423e383c4ce44ae25c9606a457a.
- Website installer integration: cc42f60724af8da9a4ce41b257a603b283c927df.
- Soundstage: 13/13 Node state tests passed, including scripted traversal of every campaign stage.
- Salvage: 9/9 Node state tests passed after fixes to checkpoint/floor crossing, grounded completion, bounded airflow and fuse range.
- JavaScript syntax checks passed. Existing canonical buildGameManifest validation passed for both new manifests.
- All 13 new payload files were downloaded from their immutable jsDelivr URLs and matched manifest byte counts and SHA-256 digests.
- Ten existing local game build tree hashes were unchanged from the previous source pin. External The Long Haul source was preserved. Arboria remains registryPending.
- Website /arcade/soundstage/ and /arcade/salvage-workbench/ returned HTTP 200. Live app.mjs contains the matching installer/player runtime scope fix. Website Pages deployment completed successfully.

## Limits

No actual browser install/play session, WebGL render, audio playback, external module graph execution, hardware or human playtest was performed. A headless state test is not visual validation. Online Engine/Three imports remain separately documented dependencies and are not payload-integrity-verified by the installer. These games remain prototypes needing runtime review.

## Distribution

The custom Games test/Chrome/Pages workflow was removed in ae1c65b050bcb1d5bc583f4e803335a3f2a5339f. Repository-level legacy GitHub Pages settings still caused GitHub-managed pages build/deployment runs; no custom Chrome test workflow was run. The canonical user-facing distribution is the existing NexusArcade BrowserInstaller on https://luminarylabs.dev/arcade/, not the Games Pages site. No repository hosting settings or credentials were changed.

This parent audit supersedes the initial unexecuted-test wording in Salvage's handoff README.
