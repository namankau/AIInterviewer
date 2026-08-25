/** Where a candidate lands when no valid destination was carried through sign-in. */
export const DEFAULT_SIGNED_IN_PATH = "/dashboard";

/**
 * Narrows a `next` parameter to a same-origin path.
 *
 * The value survives a round trip through Google, so an attacker can put anything in
 * it. Anything that is not a plain absolute path — a full URL, or the `//host` form a
 * browser reads as protocol-relative — is discarded rather than followed.
 */
export function safeNext(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return DEFAULT_SIGNED_IN_PATH;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_SIGNED_IN_PATH;
  }
  return value;
}
