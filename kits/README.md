# Shared Arcade gameplay Kits

This directory is the destination for validated Arcade-specific reusable gameplay capabilities. It contains no extracted runtime Kit yet.

Keep authored rules in their game until an extraction has a clear contract, current Core/optional-Kit comparison, materially different consumers and actual tests. Record proposals in `.agent/reuse-candidates.json`; don't create empty capability folders as implied implementations.

An approved `kits/<capability>/` should contain implementation, public entry, contract, dependency pin, tests and consumer examples. It must be independently importable and have explicit lifecycle/reset/state boundaries. Game names, maps, balance, UI and assets stay in `games/`.

Universal functionality already owned by NexusEngine Core is reused there. Broad optional capabilities may later move to NexusEngine-Kits through separate approval, with consumers pinned and parity verified. Codex skills and scripts belong in `plugins/`, not here.
