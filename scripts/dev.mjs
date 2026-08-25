#!/usr/bin/env node
/**
 * Starts the API and the web app together, with the repository-root .env loaded into
 * both. One command, one place to stop them.
 *
 *   npm run dev
 *
 * Node's built-in --env-file does the loading; there is no dotenv dependency.
 *
 * Neither service is launched through its usual wrapper script. On Windows, Node
 * refuses to spawn a .cmd or .bat file without a shell, and a shell then splits the
 * path on spaces — "C:\Users\...\Live Projects\..." becomes "C:\Users\...\Live".
 * Running the real entry points directly sidesteps both problems, on every platform:
 *
 *   web  next/dist/bin/next, under this Node
 *   api  org.gradle.wrapper.GradleWrapperMain, out of the wrapper jar — exactly what
 *        gradlew does once it has finished locating a JVM
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const apiDir = join(repoRoot, "apps", "api");
const webDir = join(repoRoot, "apps", "web");

if (!existsSync(join(repoRoot, ".env"))) {
  fail("Missing .env at the repository root. Copy .env.example to .env and fill it in.");
}

const nextEntryPoint = join(repoRoot, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextEntryPoint)) {
  fail("Dependencies are not installed. Run `npm install` first.");
}

// `java` from JAVA_HOME when it is set, otherwise whatever is on PATH.
const javaCommand = process.env.JAVA_HOME
  ? join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java")
  : "java";

const services = [
  {
    name: "api",
    command: javaCommand,
    args: [
      "-classpath",
      join("gradle", "wrapper", "gradle-wrapper.jar"),
      "org.gradle.wrapper.GradleWrapperMain",
      "bootRun",
      "--console=plain",
    ],
    cwd: apiDir,
    missing: "Java was not found. Install a JDK, or set JAVA_HOME.",
  },
  {
    name: "web",
    command: process.execPath,
    args: [nextEntryPoint, "dev"],
    cwd: webDir,
    missing: "Node could not start the web app.",
  },
];

let shuttingDown = false;

const children = services.map(({ name, command, args, cwd, missing }) => {
  const child = spawn(command, args, { cwd, stdio: "inherit", env: process.env });

  child.on("error", (error) => {
    console.error(`Could not start ${name}: ${error.message}`);
    console.error(missing);
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

function fail(message) {
  console.error(message);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}
