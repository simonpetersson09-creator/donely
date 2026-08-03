// Post-build step for the native (Capacitor / iOS) workflow.
//
// 1. Generates + hardens the static app shell at dist/client/index.html.
//    Capacitor has no SSR server at runtime, so the shell is rendered once at
//    build time and then sanitized for direct loading by WKWebView.
// 2. On macOS, creates the native iOS project (ios/App) if it does not exist
//    yet, so `npx cap sync ios` works straight after a fresh `git pull`.
//
// The build output layout (dist/client + dist/server) is pinned in vite.config.ts
// via the nitro `output` option, so this works identically on macOS, Linux and CI.
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = resolve(root, "dist/client");
const serverDir = resolve(root, "dist/server");
const outFile = resolve(clientDir, "index.html");
const iosPublicDir = resolve(root, "ios/App/App/public");

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
  const shell = harden(html);
  if (shell.includes("\0")) {
    throw new Error("The generated Capacitor shell still contains NUL bytes.");
  }
  await writeFile(outFile, shell, "utf8");
  console.log(`[capacitor] Wrote static app shell -> dist/client/index.html (${html.length} bytes)`);
}

/**
 * Copies the exact fresh web build into the Xcode project. `cap sync` still
 * remains useful for native dependency updates, but an archive can no longer
 * silently contain an older index.html or mismatched hashed JavaScript files.
 */
async function syncIosWebAssets() {
  if (!existsSync(resolve(root, "ios/App/App.xcodeproj"))) return;

  const stagingDir = `${iosPublicDir}.staging`;
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  await cp(clientDir, stagingDir, { recursive: true });

  const index = await readFile(resolve(stagingDir, "index.html"), "utf8");
  const assetReferences = [...index.matchAll(/(?:src|href)=["']\/?(assets\/[^"']+)["']/g)].map(
    (match) => match[1],
  );
  if (assetReferences.length === 0) {
    throw new Error("The iOS shell contains no bundled asset references.");
  }
  for (const relativePath of assetReferences) {
    if (!existsSync(resolve(stagingDir, relativePath))) {
      throw new Error(`The iOS shell references a missing asset: ${relativePath}`);
    }
  }

  await rm(iosPublicDir, { recursive: true, force: true });
  await rename(stagingDir, iosPublicDir);

  const copiedIndex = await readFile(resolve(iosPublicDir, "index.html"), "utf8");
  if (copiedIndex !== index || (await readdir(resolve(iosPublicDir, "assets"))).length === 0) {
    throw new Error("Verification of copied iOS web assets failed.");
  }
  console.log(`[capacitor] Synced and verified fresh web assets -> ios/App/App/public`);
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
  // Diagnostics are console-only: no DOM overlay may ever cover the app.
  // (An earlier full-screen watchdog element painted the whole screen taupe
  // whenever any script error fired, hiding a perfectly rendered UI.)
  const watchdog = `<script>(function(){function log(msg){window.__donelyLastError=msg;try{console.error("DONELY_HTML: "+msg)}catch(e){}}window.addEventListener("error",function(e){log((e.message||"Script error")+" "+(e.filename||"")+":"+(e.lineno||0))},true);window.addEventListener("unhandledrejection",function(e){var r=e.reason;log("Unhandled rejection: "+((r&&(r.stack||r.message))||String(r)))});setTimeout(function(){if(!document.querySelector("[data-donely-app-ready]"))log("Appens granssnitt renderades inte inom 8 sekunder.")},8000)})();</script>`;
  // TanStack's streamed route ids use NUL separators. A normal HTTP response
  // can carry those bytes, but an HTML file loaded directly by WKWebView cannot:
  // WebKit may stop parsing at the first NUL, before the client entry and boot
  // watchdog. Preserve the JavaScript string value with an escaped code point.
  let out = html.replaceAll("\0", "\\u0000");
  out = out.includes("</head>") ? out.replace("</head>", `${head}</head>`) : head + out;
  out = out.includes("</body>") ? out.replace("</body>", `${watchdog}</body>`) : out + watchdog;
  // Belt and braces: strip any overlay elements baked in by older builds.
  out = out.replace(/<div id="donely-(static-beacon|boot-error)"[\s\S]*?<\/div>/g, "");
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
await syncIosWebAssets();
