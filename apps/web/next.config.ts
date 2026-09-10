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
  /*
   * No framework badge, and no route-info panel, over the candidate's interview.
   *
   * These only ever render in development, but development is where the product is
   * looked at and judged — and a floating "Static Route / prerendered at build time"
   * card sitting over a live interview reads as somebody's half-finished project. The
   * information is available in the terminal and the build output either way.
   */
  devIndicators: false,
};

export default nextConfig;
