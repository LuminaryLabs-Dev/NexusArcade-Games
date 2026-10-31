---
name: arcade-validate-it
description: Validate a specific NexusArcade candidate against its intended gameplay, packaging and supported runtime.
---

# arcade-validate-it

Resolve the exact repository, slug and source/build identity. Run the bundled read-only scripts/inspect-game.mjs with --repo and --game; use its result as structural evidence only. Read ../../references/validation.md for coverage boundaries.

Read repository test instructions before executing commands. Run applicable final-code checks, then exercise the actual user surface when available: start/tutorial, meaningful success/failure, controls, pause/focus, repeated restart, disposal, resize, persistence, audio/assets and resource bounds. Preserve before/after behavior and visuals. Run real tests; never emit a PASS for an assertion that simply returns true.

Record PASS, FAIL, BLOCKED and NOT RUN separately. Bind evidence to commit/hash and environment. Native Canvas, DOM emulation and desktop touch emulation do not establish browser CSS, physical mobile or enjoyable play. Independently review actual results rather than trusting a generator's summary.

Repair only within authorization and rerun affected checks. Return the candidate verdict, exact remaining gates and one next action; do not promote registry pointers or mark accepted merely because npm test passed.
