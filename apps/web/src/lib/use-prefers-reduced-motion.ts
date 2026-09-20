"use client";

import { useEffect, useState } from "react";

/**
 * Whether the viewer has asked the OS for reduced motion. Read once on mount rather than
 * during render, so the server-rendered (JS-off) markup never depends on it — the initial
 * frame is identical either way, and this only changes whether autoplay is offered.
 */
function readPreference(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readPreference);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}
