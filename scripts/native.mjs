// Cross-platform native workflow (Windows PowerShell, macOS, Linux).
// Only Node + npx — no Bash, WSL or Git Bash required.
//
//   node scripts/native.mjs build           → fresh web build + static app shell (dist/client)
//   node scripts/native.mjs android:sync    → build + npx cap sync android
//   node scripts/native.mjs android:open    → open the project in Android Studio
//   node scripts/native.mjs android:bundle  → signed release AAB (needs android/keystore.properties)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

function run(command, args, cwd = root) {
  // .cmd/.bat launchers (npx, gradlew.bat) need a shell on Windows.
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: isWin });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function build() {
  run("node", ["scripts/clean-build.mjs"]);
  run("npx", ["vite", "build"]);
  run("node", ["scripts/capacitor-postbuild.mjs"]);
}

const task = process.argv[2];
switch (task) {
  case "build":
    build();
    break;
  case "android:sync":
    build();
    run("npx", ["cap", "sync", "android"]);
    break;
  case "android:open":
    run("npx", ["cap", "open", "android"]);
    break;
  case "android:bundle": {
    const androidDir = resolve(root, "android");
    if (!existsSync(resolve(androidDir, "keystore.properties"))) {
      console.error("Saknar android/keystore.properties – se android/keystore.properties.example.");
      process.exit(1);
    }
    build();
    run("npx", ["cap", "sync", "android"]);
    run(isWin ? "gradlew.bat" : "./gradlew", ["bundleRelease"], androidDir);
    console.log("\nKlart: android/app/build/outputs/bundle/release/app-release.aab");
    break;
  }
  default:
    console.error(`Okänt kommando: ${task ?? "(inget)"}`);
    process.exit(1);
}
