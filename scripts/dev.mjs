#!/usr/bin/env node
/**
 * Starts the API and the web app together, with the repository-root .env loaded into
 * both. One command, one place to stop them.
 *
 * Run it through the root package script so the env file is loaded:
 *   npm run dev
 *
 * Node's built-in --env-file does the loading; there is no dotenv dependency.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const isWindows = process.platform === "win32";

if (!existsSync(join(repoRoot, ".env"))) {
  console.error("Missing .env at the repository root. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const services = [
  {
    name: "api",
    command: isWindows ? "gradlew.bat" : "./gradlew",
    args: ["bootRun", "--console=plain", "--quiet"],
    cwd: join(repoRoot, "apps", "api"),
  },
  {
    name: "web",
    command: isWindows ? "npm.cmd" : "npm",
    args: ["run", "dev"],
    cwd: join(repoRoot, "apps", "web"),
  },
];

const children = services.map(({ name, command, args, cwd }) => {
  const child = spawn(command, args, { cwd, stdio: "inherit", env: process.env });

  child.on("error", (error) => {
    console.error(`Could not start ${name}: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`${name} exited (${signal ?? code}). Stopping the other process too.`);
      shutdown(code ?? 1);
    }
  });

  return child;
});

let shuttingDown = false;

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGINT");
    }
  }
  process.exitCode = exitCode;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}
