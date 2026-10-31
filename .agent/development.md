# Arcade conversion and reuse workflow

## Intake and resume

Read root AGENTS.md and the relevant run's goal, run.json, decisions and evidence. A run directory records a concrete request, not another company backlog. Use existing ticket/IDEA/NXA references and canonical project handoffs where available. Record missing identities explicitly.

Preserve the original bytes/hash, identify dependencies and assets, and inspect code before execution. Confirm the allowed repository, files, environment, branch and publication boundary. For a new game definition use the existing `arcade-define-game-it` skill when available; otherwise use the canonical game-creation guide linked below. Do not replace that workflow with a second definition system.

## Inspect and map capabilities

Establish the game's behavior contract: fantasy, decisions, controls, progression, failure, feedback, lifecycle and known defects. Audit the actual Engine pin and existing optional Kits. Classify each meaningful subsystem using the four categories in AGENTS.md; reuse-candidates.json records only reusable-system decisions, not a copy of every game task.

A reusable candidate needs exact responsibilities, source locations, current alternatives, consumer requirements, validation evidence, unresolved differences and one extraction decision. Similar names are not equivalent responsibilities. For example, an interaction request queue is not physical separation between train carriages. Timing schedules already exist in Core and should not be reimplemented as a competing universal system.

## Implement

Convert one playable path, then expand while preserving the behavior contract. Keep game-specific authored content out of Core. Shared Arcade code belongs in `kits/<capability>/` only after its contract is grounded in materially different consumers and scoped extraction approval exists. A failed comparison is useful evidence and should keep the code game-owned. Broad optional-Kit promotion to another repository is a separate change.

Avoid concurrent global build/registry generation. `sync:builds` replaces local games' build directories; use an isolated checkout and inspect its full diff. A vendored bundle is a packaging artifact with a pinned source owner, not a second authored Core implementation.

## Validate

Run the exact final source/build and relevant tests. Hash/pin evidence to the tested target. Check real success and failure, pause/hidden-tab behavior, repeated restart, teardown, input, resize, persistence, resource bounds and asset/audio failure. Compare visuals and behavior against the preserved source. Explicitly record unavailable browser/device checks; don't convert them into passes.

Use the plugin's read-only inspection helpers for identity, source/build parity and manifest validation. They do not judge fun, semantic novelty or approve a release. If checks fail, repair within scope and rerun affected checks before integration.

## Integrate and hand off

Review changed files, re-read remote main, check ID collisions, and use the authorized GitHub connector/branch. Keep the tested candidate separate from accepted/publicly installed state. Never run a promotion command simply because a skill contains it.

In `.agent/runs/<run-id>/`, keep goal.md plus run.json with stage, target, base/candidate identity, authority, evidence references, known blockers and next action. Add decisions/evidence files only when meaningful. Do not commit secrets, private customer data or large scratch logs. Update only canonical records authorized by the request.

## Canonical guides

- Game creation: https://docs.google.com/document/d/1ftlNETOvkfZf3OBX-OIphJcdgNh4YTw8J5OCxuzcmV4/edit
- Gemini conversion: https://docs.google.com/document/d/1ZQGPlyYMqGx8gTWXwjC7vogFrTcJvyYYNsGZUJrbvOk/edit
- Gemini prompts: https://docs.google.com/document/d/1iq5wG6yhPk8MR7o4VyJHPTIlAJQgLXWYRySsUzmb6qw/edit
- Sheet management: https://docs.google.com/document/d/1dlpHq7X4WXTNlGpAZV64oDmKXROIljkjc9TpHZDH4TE/edit
- Catalogue: https://docs.google.com/spreadsheets/d/1dN6pgtmnftkkzhAUTDmN0OeX5cXayvavkgcGtpAS9DQ/edit

The sheet's current raw/profile/prompt/archive schema owns preparation status. It is not proof of runtime acceptance, and this workflow does not authorize bulk sheet writes.
