import { spawnSync } from "node:child_process";

// Extra CLI flags (e.g. `--config <file>`) belong to Vite, not to the
// Capacitor copy step that runs last. Running the steps from here keeps
// forwarded arguments on the right command.
const extraArgs = process.argv.slice(2);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("node", ["scripts/clean-build.mjs"]);
run("npx", ["vite", "build", "--mode", "development", ...extraArgs]);
run("node", ["scripts/capacitor-postbuild.mjs"]);
run("npx", ["cap", "copy", "ios"]);
