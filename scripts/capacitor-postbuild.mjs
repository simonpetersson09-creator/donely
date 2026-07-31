// Post-build step for the native (Capacitor / iOS) workflow.
//
// 1. Makes sure dist/client/index.html exists so Capacitor has a static entry
//    point (the TanStack Start build normally only emits a server bundle).
//    Primary strategy: render the app shell with the built server bundle.
//    Fallback: build a minimal shell from the Vite client manifest.
// 2. On macOS, creates the native iOS project (ios/App) if it does not exist
//    yet, so `npx cap sync ios` works straight after a fresh `git pull`.
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = resolve(root, "dist/client");
const outFile = resolve(clientDir, "index.html");

/** Known locations a Nitro/TanStack Start server bundle can end up in. */
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
  // Last resort: shallow scan for an index.mjs inside dist/ or .output/
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
    if (entry === "client" || entry === "node_modules" || entry.startsWith(".")) continue;
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

async function renderWithServerBundle() {
  const serverEntry = findServerEntry();
  if (!serverEntry) return null;
  const mod = await import(`file://${serverEntry}`);
  const handler = mod.default;
  const fetchFn = typeof handler?.fetch === "function" ? handler.fetch.bind(handler) : null;
  if (!fetchFn) return null;
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const res = await fetchFn(new Request("http://localhost/"), {}, ctx);
  if (!res.ok) throw new Error(`app shell render returned HTTP ${res.status}`);
  const html = await res.text();
  if (!html.includes("<html")) throw new Error("app shell render returned no HTML document");
  return html;
}

/** Minimal shell built from the Vite client manifest (no SSR markup). */
async function shellFromManifest() {
  const manifestPath = resolve(clientDir, ".vite/manifest.json");
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const entries = Object.values(manifest).filter((chunk) => chunk.isEntry && chunk.file?.endsWith(".js"));
  if (entries.length === 0) return null;
  const scripts = entries.map((e) => `<script type="module" src="/${e.file}"></script>`).join("");
  const css = [...new Set(entries.flatMap((e) => e.css ?? []))]
    .map((href) => `<link rel="stylesheet" href="/${href}">`)
    .join("");
  return `<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Donely</title><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon-180.png">${css}</head><body><div id="root"></div>${scripts}</body></html>`;
}

async function writeShell() {
  if (!existsSync(clientDir)) {
    throw new Error(
      `Missing client build output at ${clientDir}. Run "npm run build" (vite build) before this script.`,
    );
  }

  let html = null;
  try {
    html = await renderWithServerBundle();
  } catch (error) {
    console.warn(`[capacitor] Could not render via server bundle (${error.message}). Using manifest fallback.`);
  }

  let source = "server bundle";
  if (!html) {
    html = await shellFromManifest();
    source = "vite manifest";
  }

  if (!html) {
    throw new Error(
      "Could not produce dist/client/index.html: no usable server bundle and no dist/client/.vite/manifest.json.",
    );
  }

  await mkdir(clientDir, { recursive: true });
  await writeFile(outFile, html, "utf8");
  console.log(`[capacitor] Wrote dist/client/index.html from ${source} (${html.length} bytes)`);
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
