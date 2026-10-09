import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInterviewCapture } from "@/lib/use-interview-capture";

describe("useInterviewCapture", () => {
  const track = { stop: vi.fn() };
  const stream = {
    getAudioTracks: vi.fn(() => [track]),
    getTracks: vi.fn(() => [track]),
  };
  let nextFrame: number;

  beforeEach(() => {
    nextFrame = 1;
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => nextFrame++));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "MediaStream",
      class {
        getAudioTracks = stream.getAudioTracks;
        getTracks = stream.getTracks;
      },
    );
    vi.stubGlobal(
      "AudioContext",
      class {
        createAnalyser() {
          return {
            fftSize: 0,
            frequencyBinCount: 4,
            getByteTimeDomainData: vi.fn(),
          };
        }

        createMediaStreamSource() {
          return { connect: vi.fn() };
        }

        close() {
          return Promise.resolve();
        }
      },
    );
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }

        mimeType = "audio/webm";
        state = "recording";
        ondataavailable = null;
        onstop = null;

        start() {}
        stop() {}
      },
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces the device-check meter instead of running two loops while recording", async () => {
    const { result, unmount } = renderHook(() => useInterviewCapture({ withVideo: false }));

    await act(async () => {
      await result.current.requestDevices();
    });
    await act(async () => {
      await result.current.start();
    });

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    unmount();
  });
});
