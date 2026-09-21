/** Slugifies a chapter sub-heading into the anchor id the renderer and "on this page" rail share. */
export function anchorId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
