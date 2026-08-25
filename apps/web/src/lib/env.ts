/**
 * Environment access, resolved once and loudly.
 *
 * Next inlines `NEXT_PUBLIC_*` at build time, so each variable has to be referenced
 * by its literal name rather than looked up dynamically.
 */

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env at the repository root.`);
  }
  return value;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  /** Base URL of the versioned public API that mobile clients will also consume. */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
} as const;
