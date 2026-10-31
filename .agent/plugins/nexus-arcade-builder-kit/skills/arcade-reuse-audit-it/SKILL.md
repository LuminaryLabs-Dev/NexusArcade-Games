---
name: arcade-reuse-audit-it
description: Identify and assess reusable non-Core gameplay capabilities across NexusArcade games without automatically extracting them.
---

# arcade-reuse-audit-it

Read ../../references/ownership.md. For each meaningful subsystem, compare its responsibilities with the actual Core pin and existing optional Kit source/manifests. Classify core-existing, kit-existing, arcade-candidate or game-specific. Check realBehavior, exports, source implementation and proof rather than trusting a promising Kit name.

Compare at least two materially different consumer requirements before proposing extraction: inputs/state, invariants, lifecycle/reset, errors, determinism and authored policy boundaries. Similar code or themes alone do not prove reuse. A useful audit may conclude to keep the code local or use an existing Core owner.

When record edits are authorized, update .agent/reuse-candidates.json and the scoped run with sources, alternatives, consumer findings, evidence and decision. Otherwise return the proposed update without saving it. Do not create a competing task backlog.

Use kits/<capability>/ only after the shared contract, evidence and extraction scope are approved. No automatic Core domains, optional-repository promotion, broad refactor or publishing. Report unresolved mismatches honestly; an editorial audit is not runtime parity proof.
