import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  useEffect: vi.fn()
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useEffect: refreshMocks.useEffect
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMocks.refresh })
}));

import { DoctorConsultationQueueAutoRefresh } from "@/features/doctor/DoctorConsultationQueueAutoRefresh";

type Listener = () => void;

describe("Doctor consultation queue auto refresh", () => {
  let visibilityState: DocumentVisibilityState;
  let cleanup: (() => void) | undefined;
  let intervalCallback: Listener | undefined;
  let resumeCallback: Listener | undefined;
  let windowListeners: Map<string, Listener>;
  let documentListeners: Map<string, Listener>;
  let clearIntervalMock: ReturnType<typeof vi.fn>;
  let clearTimeoutMock: ReturnType<typeof vi.fn>;
  let setIntervalMock: ReturnType<typeof vi.fn>;
  let setTimeoutMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    visibilityState = "visible";
    cleanup = undefined;
    intervalCallback = undefined;
    resumeCallback = undefined;
    windowListeners = new Map();
    documentListeners = new Map();
    clearIntervalMock = vi.fn();
    clearTimeoutMock = vi.fn();
    setIntervalMock = vi.fn((callback: Listener) => {
      intervalCallback = callback;
      return 11;
    });
    setTimeoutMock = vi.fn((callback: Listener) => {
      resumeCallback = callback;
      return 12;
    });

    vi.stubGlobal("window", {
      addEventListener: vi.fn((event: string, listener: Listener) => {
        windowListeners.set(event, listener);
      }),
      clearInterval: clearIntervalMock,
      clearTimeout: clearTimeoutMock,
      removeEventListener: vi.fn((event: string) => {
        windowListeners.delete(event);
      }),
      setInterval: setIntervalMock,
      setTimeout: setTimeoutMock
    });
    vi.stubGlobal("document", {
      addEventListener: vi.fn((event: string, listener: Listener) => {
        documentListeners.set(event, listener);
      }),
      get visibilityState() {
        return visibilityState;
      },
      removeEventListener: vi.fn((event: string) => {
        documentListeners.delete(event);
      })
    });
    refreshMocks.useEffect.mockImplementation((effect: () => void | (() => void)) => {
      cleanup = effect() ?? undefined;
    });
  });

  afterEach(() => {
    cleanup?.();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("polls every five seconds while a live queue is visible", () => {
    DoctorConsultationQueueAutoRefresh({ enabled: true });

    expect(setIntervalMock).toHaveBeenCalledTimes(1);
    expect(setIntervalMock).toHaveBeenCalledWith(expect.any(Function), 5_000);

    intervalCallback?.();

    expect(refreshMocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("coalesces focus, visible, and pageshow resume events into one immediate refresh", () => {
    DoctorConsultationQueueAutoRefresh({ enabled: true });

    windowListeners.get("focus")?.();
    documentListeners.get("visibilitychange")?.();
    windowListeners.get("pageshow")?.();

    expect(setIntervalMock).toHaveBeenCalledTimes(1);
    expect(setTimeoutMock).toHaveBeenCalledTimes(1);
    expect(refreshMocks.refresh).not.toHaveBeenCalled();

    resumeCallback?.();

    expect(refreshMocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("stops while hidden and restarts with an immediate refresh when visible again", () => {
    DoctorConsultationQueueAutoRefresh({ enabled: true });

    visibilityState = "hidden";
    documentListeners.get("visibilitychange")?.();

    expect(clearIntervalMock).toHaveBeenCalledWith(11);
    intervalCallback?.();
    expect(refreshMocks.refresh).not.toHaveBeenCalled();

    visibilityState = "visible";
    documentListeners.get("visibilitychange")?.();
    expect(setIntervalMock).toHaveBeenCalledTimes(2);

    resumeCallback?.();
    expect(refreshMocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not register listeners or timers without a live consultation", () => {
    DoctorConsultationQueueAutoRefresh({ enabled: false });

    expect(setIntervalMock).not.toHaveBeenCalled();
    expect(setTimeoutMock).not.toHaveBeenCalled();
    expect(window.addEventListener).not.toHaveBeenCalled();
    expect(document.addEventListener).not.toHaveBeenCalled();
  });

  it("cleans every timer and resume listener on unmount or prop change", () => {
    DoctorConsultationQueueAutoRefresh({ enabled: true });
    windowListeners.get("focus")?.();

    cleanup?.();
    cleanup = undefined;

    expect(clearIntervalMock).toHaveBeenCalledWith(11);
    expect(clearTimeoutMock).toHaveBeenCalledWith(12);
    expect(window.removeEventListener).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith("pageshow", expect.any(Function));
    expect(document.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
  });
});
