---
name: nexus-arcade-it
description: Route requests to create, convert, review or integrate a NexusArcade game in its content repository.
---

# nexus-arcade-it

Resolve the explicit repository and game identity, then read its AGENTS.md and .agent/development.md. Keep the current request's authorization and game intent, not a remembered default task.

- New idea or brief: use existing arcade-define-game-it when available. Otherwise follow the canonical creation guide in references/workflow.md. Ask whether the assistant or Gemini writes only if that decision is missing.
- Returned Gemini/source code: use arcade-convert-it; do not reopen settled game choices.
- Reuse/architecture question: use arcade-reuse-audit-it.
- Candidate review: use arcade-validate-it.
- Authorized repository integration: use arcade-integrate-it.

Read ../../references/workflow.md for canonical guides and stage boundaries. The plugin may be installed in a cache, so resolve the user's repository explicitly; never assume the plugin's directory is the working repository. Scripts accept an explicit --repo path and are read-only.

A plugin invocation does not grant permission to write repositories, sheets, install plugins, send messages or publish. Return actual findings, exact evidence limits and one next action. Raw ideas, curated prompts, candidate source, accepted games and public releases are different states.
