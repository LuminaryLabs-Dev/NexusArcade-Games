# Nexus Arcade Builder Kit

Version 0.2.0. A Codex-style plugin and resumable CLI for one Engine-backed Arcade game at a time. It uses the existing game-definition workflow and adds a required quality-and-repair loop before authorized registration.

Canonical location: `.agent/plugins/nexus-arcade-builder-kit/`. Repository discovery: `.agents/plugins/marketplace.json`. Portable identity: `plugin.json`; Codex compatibility identity: `.codex-plugin/plugin.json`. No new MCP server, automatic publishing hook or credentials are included.

## Start here

Read `references/cli.md`, then use `arcade-load-it` to install and verify the plugin in the actual sandbox. Installation, fresh-session model execution and game validation are separate claims. The native bootstrap verifies installed/enabled status and installed/source byte parity. Model access must already be available; the harness does not create credentials or bypass usage limits.

```sh
node .agent/plugins/nexus-arcade-builder-kit/cli.mjs help
node .agent/plugins/nexus-arcade-builder-kit/scripts/validate-plugin.mjs --repo .
node .agent/plugins/nexus-arcade-builder-kit/scripts/inspect-game.mjs --repo . --game switchyard
node --test tests/arcade-plugin.test.mjs tests/arcade-builder.test.mjs
```

The two inspection helpers are read-only. The CLI writes local run state and invokes reviewed validation commands and an authorized worker. It is a workflow harness, not an independent security sandbox or a substitute for user permission.

## Sub-skills

- `nexus-arcade-builder-it`: route the request and preserve the existing identity and writer choice.
- `arcade-load-it`: load and verify the package in the actual executor.
- `arcade-plan-it`: inspect real Engine/Core/Kit capabilities and plan the game.
- `arcade-build-it`: implement the approved game scope.
- `arcade-convert-it`: preserve and convert returned Gemini code.
- `arcade-reuse-audit-it`: classify reuse without premature extraction.
- `arcade-validate-it`: execute checks and preserve honest evidence.
- `arcade-quality-it`: review inferred human factors and route specific failures.
- `arcade-integrate-it`: integrate reviewed repository changes.
- `arcade-register-it`: verify authorized registry and Website delivery.

## Production loop

Inspect Engine → plan → implement → execute checks → inferred human-factors quality review → authorized registration. Wrong assumptions return to inspection; design or implementation defects return to planning. Missing prerequisites block explicitly. Preserve the full intent through retries and stop at the configured execution budget. A passing review does not grant publication authority, prove actual human enjoyment, or establish physical-device compatibility.

Gameplay remains in `games/`; proven shared Arcade capabilities belong in `kits/` only after separately approved extraction. Run evidence remains in `.agent/runs/`. Existing project tickets and the game catalogue remain the canonical work records.
