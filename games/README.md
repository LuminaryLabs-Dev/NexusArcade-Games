# Game layout

Each directory under `games/` is one permanent NexusArcade game slug.

```text
<slug>/
├── source/   # editable implementation
├── build/    # runtime payload downloaded file-by-file
└── install/  # metadata + generated immutable manifest
```

Rules:

- `install/game.json` owns the permanent `NXA-######` ID and display metadata.
- Local games must have `build/index.html`.
- `build/` must contain no credentials or private material.
- Registered local manifests point to `games/<slug>/build` at a full 40-character commit SHA.
- External games declare immutable source information in `install/game.json`.
- `install/manifest.json` is generated and must match `registry/games/<id>.json`.
