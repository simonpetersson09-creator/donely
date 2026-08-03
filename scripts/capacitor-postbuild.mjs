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

/**
 * Renders "/" with the built server bundle inside this Node process. The
 * TanStack client entry refuses to boot without the `$_TSR` bootstrap payload
 * that only a real server render emits, so a hand-written shell is not enough.
 */
async function renderIndex() {
  const entry = resolve(serverDir, "index.mjs");
  if (!existsSync(entry)) {
    throw new Error(`Missing ${entry}. Run \`vite build\` before the Capacitor postbuild step.`);
  }
  const mod = await import(pathToFileURL(entry).toString());
  const handler = mod.default;
  if (!handler?.fetch) {
    throw new Error("The built server bundle does not export a fetch handler.");
  }
  const res = await handler.fetch(new Request("http://localhost/"), {}, {
    waitUntil() {},
    passThroughOnException() {},
  });
  const html = await res.text();
  if (res.status !== 200 || !html.includes("$_TSR") || !html.includes('type="module"')) {
    throw new Error(
      `Server render of "/" failed (status ${res.status}, ${html.length} bytes) - refusing to ship an empty shell.`,
    );
  }
  return html;
}

async function writeShell() {
  const html = await renderIndex();
  await writeFile(outFile, harden(html), "utf8");
  console.log(`[capacitor] Wrote static app shell -> dist/client/index.html (${html.length} bytes)`);
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
