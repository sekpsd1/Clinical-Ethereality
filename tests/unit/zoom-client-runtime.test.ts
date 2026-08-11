import { describe, expect, it, vi } from "vitest";
import {
  createZoomClientInitOptions,
  revealZoomClientRoot
} from "../../zoom-client/src/sdk-runtime";

describe("isolated Zoom client runtime", () => {
  it("skips the SDK preview that blocked init and enables Zoom media hotfixes", () => {
    const success = vi.fn();
    const error = vi.fn();

    expect(createZoomClientInitOptions("https://app.example.test/consult/live", success, error)).toEqual({
      leaveUrl: "https://app.example.test/consult/live",
      patchJsMedia: true,
      disablePreview: true,
      disableRecord: true,
      leaveOnPageUnload: true,
      success,
      error
    });
  });

  it("reveals the required client-view root and fails closed when it is absent", () => {
    const root = { style: { display: "none" } };

    revealZoomClientRoot(root);

    expect(root.style.display).toBe("block");
    expect(() => revealZoomClientRoot(null)).toThrow("zoom_client_sdk_root_missing");
  });
});
