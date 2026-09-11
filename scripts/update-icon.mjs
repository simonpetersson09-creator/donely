// Uppdaterar appikonen överallt (iOS, PWA, favicon) från en källbild.
//
// Användning:
//   npm run icon -- /sökväg/till/ny-ikon.png
//
// Källbilden bör vara kvadratisk och minst 1024×1024. Scriptet använder
// macOS inbyggda `sips` (eller ImageMagick `magick` om det finns) och
// skriver om:
//   - ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png (1024)
//   - public/icon-512.png, public/icon-192.png, public/icon-180.png, public/icon-64.png
//   - public/app-icon-1024.png (refereras av manifest.webmanifest)
//   - public/favicon.png (64)
import { existsSync } from "node:fs";
import { cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2] ? resolve(process.argv[2]) : null;

if (!src || !existsSync(src)) {
  console.error("Ange sökväg till en ikonfil:  npm run icon -- /sökväg/till/ikon.png");
  process.exit(1);
}

const hasSips = spawnSync("which", ["sips"]).status === 0;
const hasMagick = spawnSync("which", ["magick"]).status === 0;
if (!hasSips && !hasMagick) {
  console.error("Varken `sips` (macOS) eller `magick` (ImageMagick) hittades.");
  process.exit(1);
}

function resize(srcPath, size, destPath) {
  const result = hasSips
    ? spawnSync("sips", ["-z", String(size), String(size), srcPath, "--out", destPath], { stdio: "pipe" })
    : spawnSync("magick", [srcPath, "-resize", `${size}x${size}^`, "-gravity", "center", "-extent", `${size}x${size}`, destPath], { stdio: "pipe" });
  if (result.status !== 0) {
    console.error(`Kunde inte skapa ${destPath}:\n${result.stderr?.toString() ?? ""}`);
    process.exit(1);
  }
  console.log(`✓ ${destPath.replace(root + "/", "")} (${size}×${size})`);
}

const targets = [
  [1024, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"],
  [1024, "public/app-icon-1024.png"],
  [512, "public/icon-512.png"],
  [192, "public/icon-192.png"],
  [180, "public/icon-180.png"],
  [64, "public/icon-64.png"],
  [64, "public/favicon.png"],
];

for (const [size, rel] of targets) {
  resize(src, size, resolve(root, rel));
}

console.log("\nKlart! Kör sedan på din Mac:");
console.log("  npm run build && npx cap sync ios");
console.log("och arkivera om i Xcode så följer den nya ikonen med till App Store.");
