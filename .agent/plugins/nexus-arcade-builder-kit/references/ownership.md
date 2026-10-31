# Reuse ownership decisions

- core-existing: universal capability has a verified current Core owner. Reuse its public contract at the consumer pin.
- kit-existing: optional capability has an implemented, usable entry and applicable proof. Inspect its exact version and gaps.
- arcade-candidate: a gameplay capability may serve multiple Arcade games but its shared contract is not yet proven.
- game-specific: authored rules, content, balance or presentation define the particular game.

An inventory manifest with realBehavior=false or migration-placeholder status is not a usable Kit. Record it as an alternative investigated, not an integration completed.

Candidate evidence must separate responsibilities, consumers and proof. Compare state units, route topology, body geometry, ownership/release semantics, deterministic time, reset/snapshot, effects and failure behavior as relevant. Distinguish a physical queue from a request queue, or authored spawn policy from Core elapsed-time scheduling.

Extraction belongs in kits/<capability>/ only when a common contract and actual consumer tests justify it and the requested mutation includes it. A broader NexusEngine-Kits promotion requires separate authority. Do not add Core domain names or placeholder runtime folders to advertise future work.
