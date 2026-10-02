import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const read = (relative) => readFile(path.join(ROOT, relative), "utf8");
const check = (source, label, module = false) => {
  const result = spawnSync(process.execPath, ["--check", `--input-type=${module ? "module" : "commonjs"}`], { input: source, encoding: "utf8" });
  assert.equal(result.status, 0, `${label} has invalid JavaScript:\n${result.stderr}`);
};
const inlineScripts = (html) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attrs]) => !/\bsrc\s*=/.test(attrs) && !/type\s*=\s*["']importmap["']/.test(attrs));

const gameDirs = (await readdir(path.join(ROOT, "games"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"));

for (const entry of gameDirs) {
  const base = `games/${entry.name}`;
  const metadata = JSON.parse(await read(`${base}/install/game.json`));
  assert.equal(metadata.slug, entry.name, `${entry.name} install metadata slug mismatch`);
  assert.match(metadata.id, /^NXA-[0-9]{6}$/);
  if (metadata.source && typeof metadata.source === "object") {
    assert.match(metadata.source.ref, /^[a-f0-9]{40}$/i, `${entry.name} must use an immutable external source ref`);
    continue;
  }
  const html = await read(`${base}/build/index.html`);
  assert.match(html, /<!doctype html>/i, `${entry.name} build must contain HTML`);
  for (const [index, [, attrs, source]] of inlineScripts(html).entries()) {
    check(source, `${entry.name} inline script ${index + 1}`, /type\s*=\s*["']module["']/.test(attrs));
  }
}

const javascriptFiles = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(full);
    else if (/\.(?:m?js)$/.test(entry.name)) javascriptFiles.push(full);
  }
}
for (const entry of gameDirs) {
  const source = path.join(ROOT, "games", entry.name, "source");
  try { await collect(source); } catch {}
}
for (const file of javascriptFiles) check(await readFile(file, "utf8"), path.relative(ROOT, file), true);

const knockout = await read("games/knockout-circuit/source/app.mjs");
const knockoutHtml = await read("games/knockout-circuit/build/index.html");
assert.match(knockout, /session\.tick\(delta\)/, "Knockout must pump multiplayer while the lobby is visible");
assert.match(knockout, /visibilitychange/);
assert.match(knockoutHtml, /NexusEngine-Kits@2ef76f0/);
assert.match(knockoutHtml, /multiplayer-host-kit\/controller\.js/);

const blood = await read("games/blood-maiden/build/index.html");
assert.match(blood, /blood-maiden-pilgrimage\/1/);
assert.match(blood, /data-touch="potion"/);
assert.match(blood, /id="ending"/);

const bubble = await read("games/bubble-raft-assault/build/index.html");
assert.match(bubble, /bubble-raft-campaign\/1/);
assert.match(bubble, /startOrContinueCampaign/);
assert.match(bubble, /New campaign/i);

const gothic = await read("games/gothic-revolt/source/src/main.js");
for (const skill of ["break","guillotine","chain","decoy","prison","tempest","totem","forest"]) assert.match(gothic, new RegExp(`skillRank\\('${skill}'\\)`), `${skill} must affect gameplay`);
const gothicHtml = await read("games/gothic-revolt/build/index.html");
assert.match(gothicHtml, /data-touch="skill1"/);
assert.match(gothicHtml, /data-touch="skill4"/);

const rift = await read("games/rift-runner/build/index.html");
assert.match(rift, /"three":"\.\/vendor\/three\/three\.module\.js"/);
assert.doesNotMatch(rift, /cdn\.jsdelivr\.net\/npm\/three/);
assert.match(await read("games/rift-runner/build/vendor/three/three.module.js"), /const REVISION = '165'/);

const catalog = await read("catalog/index.html");
assert.match(catalog, /renderFeatured\(games\.filter\(game=>game\.featured\)\)/);
const longHaul = JSON.parse(await read("games/the-long-haul/install/game.json"));
assert.match(longHaul.source.ref, /^[a-f0-9]{40}$/i);
assert.deepEqual(longHaul.source.publishPaths, ["index.html", "styles.css", "src"]);

console.log(`repository validation ok: ${gameDirs.length} games, ${javascriptFiles.length} JavaScript modules`);
