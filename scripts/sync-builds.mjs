import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GAMES = path.join(ROOT, "games");

for (const entry of (await readdir(GAMES, { withFileTypes: true })).filter((item) => item.isDirectory() && !item.name.startsWith("_"))) {
  const root = path.join(GAMES, entry.name);
  const metadata = JSON.parse(await readFile(path.join(root, "install", "game.json"), "utf8"));
  if (metadata.source && typeof metadata.source === "object") continue;
  const source = path.join(root, "source");
  const build = path.join(root, "build");
  await rm(build, { recursive: true, force: true });
  await mkdir(build, { recursive: true });
  await cp(source, build, {
    recursive: true,
    filter: (candidate) => {
      const rel = path.relative(source, candidate).replaceAll(path.sep, "/");
      if (!rel) return true;
      if (rel === "game.json" || rel === "game.ref.json" || rel === "index.parts.json" || rel === ".parts" || rel.startsWith(".parts/")) return false;
      return true;
    },
  });
  console.log(`synced ${entry.name}: source -> build`);
}
