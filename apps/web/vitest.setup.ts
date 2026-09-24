import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not implement layout observers. dnd-kit creates one at module load, while
// component tests exercise state and accessibility rather than pixel collision geometry.
class TestResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) { void callback; }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): ResizeObserverEntry[] { return []; }
}

globalThis.ResizeObserver ??= TestResizeObserver;

afterEach(cleanup);
