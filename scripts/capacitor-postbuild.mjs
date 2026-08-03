// Post-build step for the native (Capacitor / iOS) workflow.
//
// 1. Renders the app shell to dist/client/index.html so Capacitor has a static
//    entry point (the TanStack Start build only emits a server bundle + assets).
// 2. On macOS, creates the native iOS project (ios/App) if it does not exist
//    yet, so `npx cap sync ios` works straight after a fresh `git pull`.
//
// The build output layout (dist/client + dist/server) is pinned in vite.config.ts
// via the nitro `output` option, so this works identically on macOS, Linux and CI.
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, writeFile, cp } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = resolve(root, "dist/client");
const outFile = resolve(clientDir, "index.html");

/** Known locations a Nitro/TanStack Start build can end up in. */
const serverEntryCandidates = [
  "dist/server/index.mjs",
  "dist/server/server/index.mjs",
  ".output/server/index.mjs",
  "dist/index.mjs",
].map((p) => resolve(root, p));

function findServerEntry() {
  for (const candidate of serverEntryCandidates) {
    if (existsSync(candidate)) return candidate;
  }
  for (const base of [resolve(root, "dist"), resolve(root, ".output")]) {
    const found = scanForIndexMjs(base, 3);
    if (found) return found;
  }
  return null;
}

function scanForIndexMjs(dir, depth) {
  if (depth < 0 || !existsSync(dir)) return null;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  if (entries.includes("index.mjs")) {
    const file = join(dir, "index.mjs");
    if (statSync(file).isFile()) return file;
  }
  for (const entry of entries) {
    if (
      entry === "client" ||
      entry === "public" ||
      entry === "node_modules" ||
      entry.startsWith(".")
    ) {
      continue;
    }
    const full = join(dir, entry);
    try {
      if (!statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    const found = scanForIndexMjs(full, depth - 1);
    if (found) return found;
  }
  return null;
}

/** If nitro wrote the static assets elsewhere (e.g. .output/public), mirror them into dist/client. */
async function ensureClientDir() {
  if (existsSync(clientDir)) return;
  const alternatives = [".output/public", "dist/public", ".output/client"].map((p) =>
    resolve(root, p),
  );
  for (const alt of alternatives) {
    if (existsSync(alt)) {
      await cp(alt, clientDir, { recursive: true });
      console.log(`[capacitor] Copied web assets ${alt} -> dist/client`);
      return;
    }
  }
  throw new Error(
    `Missing client build output. Expected ${clientDir} (produced by "vite build"). ` +
      `Delete dist/ and .output/ and run "npm run build" again.`,
  );
}

async function writeShell() {
  await ensureClientDir();

  const serverEntry = findServerEntry();
  if (!serverEntry) {
    throw new Error(
      "Could not find the built server bundle (expected dist/server/index.mjs). " +
        'Run "npm run build" from the project root; if the problem persists, delete dist/, .output/ and node_modules/.vite and rebuild.',
    );
  }

  const mod = await import(`file://${serverEntry}`);
  const handler = mod.default;
  const fetchFn = typeof handler?.fetch === "function" ? handler.fetch.bind(handler) : null;
  if (!fetchFn) {
    throw new Error(`Server bundle at ${serverEntry} does not export a fetch handler.`);
  }
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const res = await fetchFn(new Request("http://localhost/"), {}, ctx);
  if (!res.ok) {
    throw new Error(`Failed to render app shell: HTTP ${res.status}`);
  }
  const html = await res.text();
  if (!html.includes("<html")) {
    throw new Error("App shell render did not return an HTML document.");
  }

  await mkdir(clientDir, { recursive: true });
  await writeFile(outFile, harden(html), "utf8");
  console.log(
    `[capacitor] Wrote static app shell -> dist/client/index.html (${html.length} bytes)`,
  );
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
  const watchdog = `<div id="donely-boot-error" style="display:none;position:fixed;inset:0;z-index:2147483647;background:#afa9a6;color:#1c1a19;font:14px/1.45 -apple-system,system-ui,sans-serif;padding:calc(env(safe-area-inset-top) + 24px) 20px 20px;white-space:pre-wrap;overflow:auto"></div><script>(function(){var shown=false;function show(msg){if(shown)return;shown=true;var el=document.getElementById("donely-boot-error");if(!el)return;el.textContent="Donely kunde inte starta.\\n\\n"+msg;el.style.display="block"}window.addEventListener("error",function(e){show((e.message||"Script error")+"\\n"+(e.filename||"")+":"+(e.lineno||0))},true);window.addEventListener("unhandledrejection",function(e){var r=e.reason;show("Unhandled rejection: "+((r&&(r.stack||r.message))||String(r)))});setTimeout(function(){var b=document.body;if(b&&b.innerText.trim().length===0)show("Appen svarade inte inom 8 sekunder (inget innehåll renderades).")},8000)})();</script>`;
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
