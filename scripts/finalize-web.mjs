import { readFile, writeFile, mkdir, copyFile, cp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { writeLegalPages } from "./legal-pages.mjs";
import { webVersionGuard } from "./web-version-guard.mjs";
import { writeCatalogRoutes } from "./web-routes.mjs";
await mkdir("dist/media", { recursive: true });
await copyFile("assets/posters/gece-hatti.png", "dist/media/gece-hatti.png");
await copyFile("assets/icons/logo-transparent.png", "dist/media/icon.png");
await cp("assets/subtitles/published", "dist/media/subtitles", { recursive: true });
const version = JSON.parse(await readFile("package.json", "utf8")).version;
let commit = "uncommitted";
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
} catch {}
let html = await readFile("dist/index.html", "utf8");
html = html
  .replace(
    /<title>.*?<\/title>/,
    "<title>DraBornSeries — Bir sonraki hikâyen</title>",
  )
  .replace('<html lang="en">', '<html lang="tr">')
  .replace(
    "</head>",
    '<meta name="theme-color" content="#09080f"><meta name="description" content="DraBornSeries: kısa hikâyeler, BornCoins ve Android + Web senkron izleme deneyimi."><link rel="manifest" href="/DraBornSeries/manifest.webmanifest"><style>html,body,#root{background:#09080f;color:#faf5ff}body{overscroll-behavior-y:none}*{box-sizing:border-box}input,textarea{outline:none}input:focus,textarea:focus{border-color:#f143a1!important}::-webkit-scrollbar{width:5px;height:4px}::-webkit-scrollbar-thumb{background:#49304f;border-radius:5px}@media(prefers-reduced-motion:reduce){*{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important}}</style></head>',
  );
html = html.replace("</head>", '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"><meta http-equiv="Pragma" content="no-cache">' + webVersionGuard(version, commit) + "</head>");
await writeFile("dist/_headers", "/DraBornSeries/*\n  Cache-Control: no-store, max-age=0, must-revalidate\n/DraBornSeries/DBS-SOURCE.json\n  Cache-Control: no-store, max-age=0, must-revalidate\n");
await writeFile("dist/index.html", html);
await writeFile(
  "dist/manifest.webmanifest",
  JSON.stringify(
    {
      name: "DraBornSeries",
      short_name: "DraBornSeries",
      start_url: "/DraBornSeries/",
      scope: "/DraBornSeries/",
      display: "standalone",
      background_color: "#09080f",
      theme_color: "#09080f",
      icons: [
        {
          src: "/DraBornSeries/media/icon.png",
          sizes: "1254x1254",
          type: "image/png",
          purpose: "any",
        },
      ],
    },
    null,
    2,
  ),
);
await writeFile("dist/.nojekyll", "");
await writeLegalPages();
await writeCatalogRoutes(html);
await writeFile(
  "dist/DBS-SOURCE.json",
  JSON.stringify(
    {
      version,
      commit,
      builtAt: new Date().toISOString(),
      schema: "drabornseries",
    },
    null,
    2,
  ),
);
console.log("Web export ready for /DraBornSeries/.");
