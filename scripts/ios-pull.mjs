// Säker `git pull` för det här projektet.
//
// Xcode och `npx cap sync ios` skriver om ios/App/App.xcodeproj/project.pbxproj
// (utvecklarteam, provisioning, LastUpgradeCheck, build-nummer, pod-referenser).
// De ändringarna är alltid lokala och behöver aldrig behållas – men de blockerar
// `git pull`. Det här skriptet tar en säkerhetskopia, återställer projektfilen
// och kör sedan pull.
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pbxproj = "ios/App/App.xcodeproj/project.pbxproj";
const backupDir = resolve(root, "ios/.local-backups");

function git(args, opts = {}) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe", ...opts });
}

const dirty = git(["status", "--porcelain", "--", pbxproj]).stdout.trim();

if (dirty) {
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = resolve(backupDir, `project.pbxproj.${stamp}`);
  if (existsSync(resolve(root, pbxproj))) copyFileSync(resolve(root, pbxproj), backup);
  console.log(`[ios-pull] Lokala ändringar i ${pbxproj} sparade som ${backup}`);
  const restore = git(["checkout", "--", pbxproj]);
  if (restore.status !== 0) {
    console.error(restore.stderr);
    process.exit(restore.status ?? 1);
  }
  console.log("[ios-pull] Projektfilen återställd.");
} else {
  console.log("[ios-pull] Projektfilen är redan ren.");
}

const pull = spawnSync("git", ["pull"], { cwd: root, stdio: "inherit" });
if (pull.status !== 0) process.exit(pull.status ?? 1);

console.log(
  "[ios-pull] Klart. Kör sedan: npm run build && npx cap sync ios (välj ditt Team i Xcode igen om det behövs).",
);
