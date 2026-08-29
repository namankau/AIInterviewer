import { existsSync } from "node:fs";
import { join } from "node:path";

import type { NextConfig } from "next";

/*
 * There is one .env, at the repository root, shared by both apps. Next only looks in
 * its own directory, so load the root file here — for dev, build and start alike.
 * Variables already present in the environment win, which is what CI and deployments
 * rely on.
 */
const rootEnvFile = join(process.cwd(), "..", "..", ".env");
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const nextConfig: NextConfig = {
  // Shared API types are consumed straight from TypeScript source in the workspace.
  transpilePackages: ["@acemyinterview/shared"],
  typedRoutes: true,
};

export default nextConfig;
