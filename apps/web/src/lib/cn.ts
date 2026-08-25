/** Joins class names, dropping anything falsy. Deliberately not a dependency. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
