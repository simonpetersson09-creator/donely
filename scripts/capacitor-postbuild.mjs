// Post-build step for the native (Capacitor / iOS) workflow.
//
// 1. Generates + hardens the static SPA shell at dist/client/index.html.
//    Capacitor has no SSR server at runtime, so the shell is assembled from the
//    build manifest (client entry script + CSS bundle) instead of replaying an
//    SSR response or relying on TanStack's prerender (which needs a Node server
//    entry that the Cloudflare nitro preset does not emit).
// 2. On macOS, creates the native iOS project (ios/App) if it does not exist
//    yet, so `npx cap sync ios` works straight after a fresh `git pull`.
//
// The build output layout (dist/client + dist/server) is pinned in vite.config.ts
// via the nitro `output` option, so this works identically on macOS, Linux and CI.
import { existsSync } from "node:fs";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = resolve(root, "dist/client");
const serverDir = resolve(root, "dist/server");
const outFile = resolve(clientDir, "index.html");

async function findClientEntry() {
  const files = await readdir(serverDir);
  const manifestFile = files.find((f) => f.startsWith("_tanstack-start-manifest_v-"));
  if (!manifestFile) {
    throw new Error(`No TanStack start manifest found in ${serverDir}.`);
  }
  const manifest = await readFile(resolve(serverDir, manifestFile), "utf8");
  const rootBlock = manifest.slice(manifest.indexOf("__root__"));
  const scripts = rootBlock.slice(rootBlock.indexOf("scripts:"));
  const match = scripts.match(/src: "(\/assets\/[^"]+\.js)"/);
  if (!match) {
    throw new Error("Could not resolve the client entry script from the build manifest.");
  }
  return match[1];
}

async function writeShell() {
  const entry = await findClientEntry();
  const assets = await readdir(resolve(clientDir, "assets"));
  const css = assets.filter((f) => f.endsWith(".css")).map((f) => `/assets/${f}`);

  const html = `<!DOCTYPE html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <title>Donely</title>
    <link rel="icon" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/icon-180.png" />
${css.map((href) => `    <link rel="stylesheet" href="${href}" />`).join("\n")}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${entry}"></script>
  </body>
</html>
`;

  await writeFile(outFile, harden(html), "utf8");
  console.log(`[capacitor] Wrote static SPA shell -> dist/client/index.html (entry ${entry})`);
}


/**
 * The native shell loads this file from a file/capacitor URL with no server
 * behind it. Two safety nets are baked in so a failed boot can never show up
 * as a plain black screen (which is impossible to debug from TestFlight):
 *
 *  1. An inline background color on <html>/<body>, so the app color is on
 *     screen even if the CSS bundle fails to load.
 *  2. A boot watchdog: if the app has not rendered anything after 8s, or a
 *     script error / unhandled rejection happens, the reason is displayed.
 */
function harden(html) {
  const head = `<style>html,body{background-color:#afa9a6;color:#1c1a19}</style>`;
  const watchdog = `<div id="donely-boot-error" style="display:none;position:fixed;inset:0;z-index:2147483647;background:#afa9a6;color:#1c1a19;font:14px/1.45 -apple-system,system-ui,sans-serif;padding:calc(env(safe-area-inset-top) + 24px) 20px 20px;white-space:pre-wrap;overflow:auto"></div><script>(function(){var shown=false;function show(msg){if(shown)return;shown=true;var el=document.getElementById("donely-boot-error");if(!el)return;el.textContent="Donely kunde inte starta.\\n\\n"+msg;el.style.display="block"}window.addEventListener("error",function(e){show((e.message||"Script error")+"\\n"+(e.filename||"")+":"+(e.lineno||0))},true);window.addEventListener("unhandledrejection",function(e){var r=e.reason;show("Unhandled rejection: "+((r&&(r.stack||r.message))||String(r)))});document.querySelectorAll('script[type="module"][src]').forEach(function(s){s.addEventListener("error",function(){show("JavaScript-filen kunde inte laddas:\\n"+(s.getAttribute("src")||"okänd fil"))})});setTimeout(function(){if(!document.querySelector("[data-donely-app-ready]"))show("Appens gränssnitt renderades inte inom 8 sekunder.")},8000)})();</script>`;
  let out = html;
  out = out.includes("</head>") ? out.replace("</head>", `${head}</head>`) : head + out;
  out = out.includes("</body>") ? out.replace("</body>", `${watchdog}</body>`) : out + watchdog;
  return out;
}


function ensureIosProject() {
  if (process.platform !== "darwin") return;
  if (existsSync(resolve(root, "ios/App/App.xcodeproj"))) return;
  console.log("[capacitor] iOS project missing - running `cap add ios`...");
  const result = spawnSync("npx", ["cap", "add", "ios"], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    console.warn("[capacitor] `cap add ios` failed. Run it manually: npx cap add ios");
  }
}

await writeShell();
ensureIosProject();
