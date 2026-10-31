# Executable builder workflow

This is a resumable production harness, not a model bundled with the repository. It launches a configured Node worker, with Codex as the default. Model credentials, tools, network and permissions must exist in the actual executor. Installation is not proof of model execution. No command sends outreach or automatically authorizes publishing.

## Load in the actual sandbox

From the repository root, with Node 20+ and the official Codex CLI available:

```sh
node .agent/plugins/nexus-arcade-builder-kit/cli.mjs bootstrap --repo "$PWD" --home /tmp/arcade-codex-home --codex /opt/codex/bin/codex
```

Choose a home appropriate to the executor. An empty isolated home can prove installation but has no inherited model login. Bootstrap registers the repository marketplace, installs/enables the plugin and compares installed bytes. It stores a local ignored receipt. Repeat after changes and begin a fresh Codex session. Do not copy credentials into evidence or claim a text read loaded the plugin. Agents API sandbox integrations must expose this plugin root as an actual capability directory, not merely mount the repository.

## Prepare one explicit run

Write the complete approved game intent to a text file and a reviewed configuration such as:

```json
{
  "authorityReference": "Exact user request or approved ticket link",
  "allowImplementation": true,
  "allowRegistration": false,
  "allowCoreChanges": false,
  "allowedPaths": ["games/example/", "tests/example.test.mjs"],
  "commands": [{"command": "node", "args": ["--test", "tests/example.test.mjs"], "timeoutMs": 300000}],
  "maxCycles": 5,
  "requireVisualEvidence": true,
  "requireHumanPlaytest": false,
  "requireWebsiteInstall": true,
  "branch": "main"
}
```

Commands execute as argument arrays without a shell, but they still run repository code. Review them and the worker before authorizing execution. The harness does not constitute a security sandbox. Allowed paths describe exact files or directory subtrees. Include registry/Website paths only when explicitly approved. Never weaken evidence requirements simply to obtain a pass.

```sh
node .agent/plugins/nexus-arcade-builder-kit/cli.mjs init --repo "$PWD" --engine /path/to/NexusEngine --game example --run example-001 --intent /path/to/intent.txt --config /path/to/config.json
node .agent/plugins/nexus-arcade-builder-kit/cli.mjs run --repo "$PWD" --run example-001
node .agent/plugins/nexus-arcade-builder-kit/cli.mjs status --repo "$PWD" --run example-001
```

Only one active product owns the repository. Run state, intent hash, Engine pin, decisions, logs and next action remain under `.agent/runs/<run>/`. Keep the same run through retries. Do not overwrite another worker's target or tracker. Runtime state is ignored by Git; deliberately curate a non-secret delivery receipt for committed evidence.

## Stage protocol

A custom worker is a reviewed Node file passed with `--worker /absolute/file.mjs`. It reads one JSON request on stdin and writes exactly one JSON report on stdout. Send diagnostics to stderr. `next` prints the current complete stage contract. `submit --report FILE` accepts the same protocol for a coordinating agent. The CLI itself owns executable verification; workers cannot submit a verification pass.

- Inspect: `status: complete`, `engineCommit`, nonempty `mapping`. Each row contains responsibility, owner (`core-existing`, `kit-existing`, `arcade-candidate`, `game-specific`), source (`engine:src/...` or `repo:games/...`), decision. Core rows also require a real `packageExport`.
- Plan: `status: complete`, `engineCommit`, nonempty `steps` and `acceptance`; disclose `requiresCoreChanges`.
- Implement: `status: complete`, actual nonempty `evidencePaths`. Source and build must match before checks.
- Verify: harness runs reviewed commands and captures real exit codes and logs. Failures return to plan; missing executables or timeouts block.
- Quality: `status: pass|fail|blocked`, `artifactDigest` from verification, `engineCommit`, `kind: inferred-human-factors`, `blockingFindings`, and `criteria` for clarity, agency, feedback, challenge, recovery, coherence, accessibility. Every criterion has `verdict`, `observation`, `evidencePaths`. Include current visual/interaction captures. Actual human testing is a separate `humanPlaytest` field with verdict and evidence, never implied by inference.
- Failed quality: provide specific `remediations` and `returnTo: inspect|plan`. Wrong premises go to inspect; implementation/design defects go to plan. Payload changes invalidate prior verification/review. An Engine pin change returns to inspect.
- Register: explicit authority plus an unchanged quality-cleared payload. Report `status: complete`, actual 40-character `commit`, approved `branch`, evidence paths and actual `installed`, `launched`, `closed` booleans when Website delivery is required. The harness checks the remote head; it does not independently simulate a browser or trust a screenshot as proof of all interactions.
- Any stage: `status: blocked`, precise `reason` for missing hardware, login, permission, provider or evidence. Blockers do not trigger endless retries.

## Resume and approval

`resume` continues a resolved blocker. Budget exhaustion requires `resume --max-cycles N` with a deliberately increased budget (maximum100); it does not reset the intent. A quality pass without registration authority waits for approval. `authorize --approval FILE` requires explicit JSON `allowRegistration: true` and the actual `authorityReference`; this records human authorization, not a substitute for it. `cancel` stops and preserves the run. A stale lock after an interrupted process requires verifying no worker still owns the run before manual recovery; never delete an active worker's lock.

## Definition of delivery

A passing unit suite, inference-based quality review, actual human playtest, browser execution, published registry and live Website installation are separate evidence levels. Report each accurately. Preserve unrelated games and release pins. Stop when the agreed delivery is verified or an exact missing prerequisite needs action. The CLI cannot guarantee that a game is enjoyable; it makes the review explicit and prevents ordinary stage-skipping.
