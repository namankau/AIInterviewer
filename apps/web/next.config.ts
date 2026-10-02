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

/*
 * Browser hardening that cannot break a page, sent on every response.
 *
 * The interview room opens the microphone and camera, so it must never be framed by
 * another site (clickjacking a consent click is the attack) and no third-party frame may
 * ask for either device. A full script/style Content-Security-Policy is deliberately not
 * here yet: Pyodide, Supabase, signed storage URLs and blob audio each need allowances
 * that should be proven in a real browser before they are enforced.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

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
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
