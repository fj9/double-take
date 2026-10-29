// Bundles the core and the command line into one file, and zips the skill for download.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
const root = join(dist, "doubletake-chart");
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(root, "scripts"), { recursive: true });

await build({
  entryPoints: [join(here, "src/cli.ts")],
  outfile: join(root, "scripts/doubletake.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  minify: false,
  // The decoders are CommonJS and use require(); give the ES module one.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
});
cpSync(join(here, "SKILL.md"), join(root, "SKILL.md"));

const zip = join(dist, "doubletake-chart-skill.zip");
execFileSync("zip", ["-r", "-q", "-X", zip, "doubletake-chart"], { cwd: dist });
// The app serves the zip for download
const publicDir = join(here, "../app/public/skill");
mkdirSync(publicDir, { recursive: true });
cpSync(zip, join(publicDir, "doubletake-chart-skill.zip"));
console.log(`skill built: ${statSync(join(root, "scripts/doubletake.mjs")).size} bytes of script, ${statSync(zip).size} bytes zipped`);
