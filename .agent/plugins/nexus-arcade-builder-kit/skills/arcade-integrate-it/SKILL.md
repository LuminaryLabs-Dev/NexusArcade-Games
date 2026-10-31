---
name: arcade-integrate-it
description: Integrate an authorized, validated NexusArcade candidate into the content repository while preserving release gates.
---

# arcade-integrate-it

Read ../../references/integration.md and the repository's current docs/website-installer-distribution.md. Confirm the user's permitted branch/action and exact candidate. Read remote main and existing permanent IDs immediately before writing. Preserve unrelated changes and coordinate shared outputs with one integrator.

Run final checks and inspect the complete diff, source/build identity, assets and provenance. Respect the requested GitHub connector and main-branch preference when specified. Do not infer push authority from a request only to plan or review. Do not force-push. For uncertain writes, inspect state before retrying; a denied action is not permission to switch channels.

Candidate integration is separate from immutable registry promotion, deployment, release tags and acceptance. Keep registryPending where appropriate. Only perform publication when exact authority and acceptance evidence exist; never advance source/ref/latest locks as an incidental build step.

Verify the expected remote commit and file content after integration. Record only authorized handoff/ticket/sheet changes. Return commit, game identity, performed checks, missing release gates and next action.
