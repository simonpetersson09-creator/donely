// Cross-platform native workflow (Windows PowerShell, macOS, Linux).
// Only Node — no npx, Bash, WSL or Git Bash required.
//
//   node scripts/native.mjs build           → fresh web build + static app shell (dist/client)
//   node scripts/native.mjs android:sync    → build + cap sync android
//   node scripts/native.mjs android:open    → open the project in Android Studio
//   node scripts/native.mjs android:bundle  → signed release AAB (needs android/keystore.properties)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

// Capacitor CLI is invoked through its local Node entrypoint with the current
// Node executable. This works identically on Windows PowerShell, macOS and
// Linux and never depends on npx resolving a .cmd shim.
const capCli = resolve(root, "node_modules/@capacitor/cli/bin/capacitor");

function run(command, args, cwd = root, shell = false) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function cap(args) {
  if (!existsSync(capCli)) {
    console.error("Capacitor CLI hittades inte. Kör `npm install` först.");
    process.exit(1);
  }
  run(process.execPath, [capCli, ...args]);
}

function build() {
  run(process.execPath, ["scripts/clean-build.mjs"]);
  run(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "build"]);
  run(process.execPath, ["scripts/capacitor-postbuild.mjs"]);
}

const task = process.argv[2];
switch (task) {
  case "build":
    build();
    break;
  case "android:sync":
    build();
    cap(["sync", "android"]);
    break;
  case "android:open":
    cap(["open", "android"]);
    break;
  case "android:bundle": {
    const androidDir = resolve(root, "android");
    if (!existsSync(resolve(androidDir, "keystore.properties"))) {
      console.error("Saknar android/keystore.properties – se android/keystore.properties.example.");
      process.exit(1);
    }
    build();
    cap(["sync", "android"]);
    // gradlew.bat needs a shell on Windows.
    run(isWin ? "gradlew.bat" : "./gradlew", ["bundleRelease"], androidDir, isWin);
    console.log("\nKlart: android/app/build/outputs/bundle/release/app-release.aab");
    break;
  }
  default:
    console.error(`Okänt kommando: ${task ?? "(inget)"}`);
    process.exit(1);
}
