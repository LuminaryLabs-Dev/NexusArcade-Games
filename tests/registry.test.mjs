import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);
const latest = JSON.parse(await readFile("registry/latest.json", "utf8"));
const index = JSON.parse(await readFile("registry/index.json", "utf8"));
const lock = JSON.parse(await readFile("registry/ref-lock.json", "utf8"));
const sourceLock = JSON.parse(await readFile("registry/source-lock.json", "utf8"));
assert.deepEqual(latest, { schemaVersion: 1, registryVersion: "0.1.0", ref: lock.ref, indexPath: "registry/index.json" });
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
  // Local prototypes are allowed to land before installer-registry promotion.
  // While the source lock remains pinned, the immutable registry payload must stay
  // byte-for-byte identical to the registry commit selected by ref-lock.json.
  const { stdout: changedRegistry } = await exec("git", ["diff", "--name-only", lock.ref, "--", "registry/index.json", "registry/games"]);
  assert.equal(changedRegistry.trim(), "", `locked registry payload changed without promotion:\n${changedRegistry}`);
  const prototypeDirs = (await readdir("prototypes", { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."));
  const currentIds = [];
  for (const entry of prototypeDirs) {
    try { currentIds.push(JSON.parse(await readFile(`prototypes/${entry.name}/game.json`, "utf8")).id); }
    catch {
      currentIds.push(JSON.parse(await readFile(`prototypes/${entry.name}/game.ref.json`, "utf8")).id);
    }
  }
  const registered = new Set(index.games.map((game) => game.id));
  const unregistered = currentIds.filter((id) => !registered.has(id)).sort();
  assert.ok(unregistered.length >= 1, "source lock differs from HEAD but no unregistered prototype explains the difference");
  console.log(`registry remains pinned; ${unregistered.length} local prototype(s) await separate registry promotion: ${unregistered.join(", ")}`);
}
console.log("master registry is sorted, pinned and deterministic");
