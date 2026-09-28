import { cp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
const target = path.resolve(
  process.argv[2] || "../DrabornEagle_Web/DraBornSeries",
);
if (path.basename(target) !== "DraBornSeries")
  throw Error("Target must be a DraBornSeries directory.");
await readFile("dist/index.html");
await mkdir(target, { recursive: true });
await cp("dist", target, { recursive: true });
console.log(`Copied verified web export to ${target}`);
