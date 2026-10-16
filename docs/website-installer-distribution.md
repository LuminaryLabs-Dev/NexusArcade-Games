# Website installer distribution

The public Arcade interface is https://luminarylabs.dev/arcade/ and uses the existing NexusArcade BrowserInstaller and ArcadePlayer. This repository owns source, browser-ready payloads and immutable registry manifests. GitHub CI testing and Games Pages deployment are no longer part of the publishing path (owner direction, 2026-10-16).

Run checks in an authorized development environment. Do not treat a commit as test evidence. Commit payload bytes first, generate manifests with actual byte lengths and SHA-256 for that immutable source revision, commit the registry, then advance the immutable latest pointer. Keep install/manifest.json equal to registry/games/<ID>.json. Website routes reuse the existing installer; no replacement installer is introduced.
