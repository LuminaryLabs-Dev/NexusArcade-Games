# NexusArcade Games

Authoritative source, runnable builds, install metadata, registry data, and public catalog inputs for NexusArcade games.

## Repository contract

Every game lives at:

```text
games/<slug>/
├── source/      # developer/agent-owned source
├── build/       # browser-runnable files; immutable install source after commit
└── install/
    ├── game.json
    └── manifest.json   # generated once the game is registered
```

`source/` is where humans and agents edit the game. `build/` is the CDN-addressable runtime payload. `install/game.json` is the authoritative game metadata. `install/manifest.json` mirrors the immutable registry manifest for registered games.

The old `prototypes/` layout is retired. Permanent `NXA-######` IDs are preserved.

## File-by-file installation

NexusArcade does not need a ZIP. Registered manifests list every installable file with:

```text
path
bytes
sha256
```

Each local game's manifest points to an immutable commit:

```text
repository: LuminaryLabs-Dev/NexusArcade-Games
ref: <40-character commit SHA>
basePath: games/<slug>/build
```

The NexusArcade installer turns those fields into jsDelivr URLs, downloads each file separately, verifies its size and SHA-256 digest, and only then commits the installation.

## Editing a game

1. Edit `games/<slug>/source/`.
2. Run `npm run sync:builds` to refresh local `build/` folders.
3. Run `npm test`.
4. Commit the source/build change.
5. Put that immutable commit SHA in `registry/source-lock.json`.
6. Run `npm run build:site` and `npm run build:registry`.
7. Commit the generated registry + `install/manifest.json` files.
8. Put that registry commit SHA in `registry/ref-lock.json`, rebuild the registry pointer, and commit.

This two-stage promotion prevents an unrelated push from changing installed bytes.

## External/reference games

A game may keep source in another repository. Its `install/game.json` contains a `source` object with an immutable commit SHA, deploy path, and optional publish allowlist. CI materializes that build for Pages and hashes the exact published files into the install manifest.

## Registry

```text
registry/
├── latest.json
├── index.json
├── source-lock.json
├── ref-lock.json
└── games/
    └── NXA-######.json
```

`registry/latest.json` is the moving pointer. It selects an immutable registry commit. The registry and each game's `install/manifest.json` carry identical install manifests.

Games marked `"registryPending": true` in `install/game.json` can exist in source/build form without entering the installer registry yet.

## Public catalog

GitHub Pages is generated into `_site/`. The catalog remains a presentation surface; installers consume the registry rather than scraping Pages.

## Private external repositories

CI may use the optional read-only `NEXUS_ARCADE_REPO_TOKEN` to materialize explicitly referenced private game repositories. The token is never written into the site or game manifests.

Runtime browser secrets are prohibited.

## Commands

```bash
npm run sync:builds
npm run build:site
npm run build:registry
npm run build
npm test
```
