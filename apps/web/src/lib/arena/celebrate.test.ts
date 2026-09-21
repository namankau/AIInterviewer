import { afterEach, describe, expect, it, vi } from "vitest";

const { confettiMock } = vi.hoisted(() => ({ confettiMock: vi.fn() }));
vi.mock("canvas-confetti", () => ({ default: confettiMock }));

import { celebrate } from "@/lib/arena/celebrate";

describe("celebrate", () => {
  afterEach(() => {
    confettiMock.mockClear();
  });

  it("does not fire when the viewer prefers reduced motion", () => {
    celebrate(true);
    expect(confettiMock).not.toHaveBeenCalled();
  });

  it("fires, with disableForReducedMotion set, when motion is not reduced", () => {
    celebrate(false);
    expect(confettiMock).toHaveBeenCalledTimes(1);
    expect(confettiMock.mock.calls[0]![0]).toMatchObject({ disableForReducedMotion: true });
  });
});
