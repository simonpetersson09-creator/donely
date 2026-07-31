// Post-build step for the native (Capacitor / iOS) workflow.
//
// 1. Renders the app shell to dist/client/index.html so Capacitor has a static
//    entry point (the TanStack Start build normally only emits a server bundle).
// 2. On macOS, creates the native iOS project (ios/App) if it does not exist yet,
//    so that `npx cap sync ios` works straight after a fresh `git pull`.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = resolve(root, "dist/server/index.mjs");
const outDir = resolve(root, "dist/client");
const outFile = resolve(outDir, "index.html");

async function renderShell() {
  if (!existsSync(serverEntry)) {
    throw new Error(`Missing server bundle at ${serverEntry}. Run "npm run build" first.`);
  }
  const mod = await import(`file://${serverEntry}`);
  const handler = mod.default;
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const res = await handler.fetch(new Request("http://localhost/"), {}, ctx);
  if (!res.ok) {
    throw new Error(`Failed to render app shell: HTTP ${res.status}`);
  }
  const html = await res.text();
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, html, "utf8");
  console.log(`[capacitor] Wrote static app shell -> dist/client/index.html (${html.length} bytes)`);
}

function ensureIosProject() {
  if (process.platform !== "darwin") return;
  if (existsSync(resolve(root, "ios/App/App.xcodeproj"))) return;
  console.log("[capacitor] iOS project missing - running `cap add ios`...");
  const result = spawnSync("npx", ["--no-install", "cap", "add", "ios"], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    console.warn('[capacitor] `cap add ios` failed. Run it manually: npx cap add ios');
  }
}

await renderShell();
ensureIosProject();
