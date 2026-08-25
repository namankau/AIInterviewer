#!/usr/bin/env node
/**
 * Runs the repo-pinned Supabase CLI with the root .env loaded.
 *
 * Two problems this solves, both of which have already bitten us:
 *
 * 1. A globally installed CLI (scoop, brew, the installer) shadows the pinned one and
 *    is usually older. An older CLI cannot parse a config.toml written by a newer one,
 *    and fails with a misleading "invalid keys" error. This always uses the version in
 *    node_modules, so every machine and CI agree.
 *
 * 2. `supabase login` stores one token per machine. If you are signed in to more than
 *    one Supabase account, whichever you logged into last wins — and commands fail
 *    with a privileges error that reads like a permissions problem rather than a
 *    wrong-account one. Setting SUPABASE_ACCESS_TOKEN in .env pins this repository to
 *    the account that owns the project, whatever the global login happens to be.
 *
 * SUPABASE_ACCESS_TOKEN is optional; without it the CLI falls back to the stored login.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Run the CLI's entry point under this Node rather than the .bin shim: the shim needs a
// shell on Windows, and a shell mangles paths containing spaces.
const entryPoint = join(repoRoot, "node_modules", "supabase", "dist", "supabase.js");

if (!existsSync(entryPoint)) {
  console.error("The pinned Supabase CLI is missing. Run `npm install` first.");
  process.exit(1);
}

const child = spawn(process.execPath, [entryPoint, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Could not run the Supabase CLI: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
