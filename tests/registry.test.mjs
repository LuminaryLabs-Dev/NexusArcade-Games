import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);
const latest = JSON.parse(await readFile("registry/latest.json", "utf8"));
const index = JSON.parse(await readFile("registry/index.json", "utf8"));
const lock = JSON.parse(await readFile("registry/ref-lock.json", "utf8"));
const sourceLock = JSON.parse(await readFile("registry/source-lock.json", "utf8"));
assert.deepEqual(latest, { schemaVersion: 1, registryVersion: "0.2.0", ref: lock.ref, indexPath: "registry/index.json" });
assert.match(latest.ref, /^(?:registry-v\d+\.\d+\.\d+|[a-f0-9]{40})$/);
assert.match(sourceLock.localSourceRef, /^[a-f0-9]{40}$/);
assert.equal(index.schemaVersion, 1);
assert.equal(index.registryVersion, latest.registryVersion);
const manifestFiles = (await readdir("registry/games")).filter((file) => /^NXA-[0-9]{6}\.json$/.test(file));
assert.equal(index.games.length, manifestFiles.length);
assert.deepEqual(index.games.map((game) => game.id), [...index.games.map((game) => game.id)].sort());
assert.equal(new Set(index.games.map((game) => game.id)).size, index.games.length);

const { stdout: headOut } = await exec("git", ["rev-parse", "HEAD"]);
const head = headOut.trim();
if (head === sourceLock.localSourceRef) {
  const { stdout, stderr } = await exec(process.execPath, ["scripts/build-registry.mjs", "--check"]);
  assert.match(stdout, /deterministic and current/);
  assert.equal(stderr, "");
} else {
  const { stdout: changedRegistry } = await exec("git", ["diff", "--name-only", lock.ref, "--", "registry/index.json", "registry/games"]);
  assert.equal(changedRegistry.trim(), "", `locked registry payload changed without promotion:\n${changedRegistry}`);
  const gameDirs = (await readdir("games", { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."));
  const pending = [];
  for (const entry of gameDirs) {
    const metadata = JSON.parse(await readFile(`games/${entry.name}/install/game.json`, "utf8"));
    if (metadata.registryPending === true) pending.push(metadata.id);
  }
  console.log(`registry remains pinned while source changes await promotion${pending.length ? `: ${pending.sort().join(", ")}` : ""}`);
}
console.log("master registry is sorted, pinned and deterministic");
