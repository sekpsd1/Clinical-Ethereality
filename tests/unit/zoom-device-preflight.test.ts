import { describe, expect, it, vi } from "vitest";
import {
  checkZoomCameraAndMicrophone,
  getZoomMediaPreflightMessage,
  ZoomMediaPreflightError
} from "../../zoom-client/src/device-preflight";

function mediaStream(audioTracks: number, videoTracks: number) {
  const tracks = Array.from({ length: audioTracks + videoTracks }, () => ({ stop: vi.fn() }));

  return {
    tracks,
    stream: {
      getAudioTracks: () => tracks.slice(0, audioTracks),
      getVideoTracks: () => tracks.slice(audioTracks),
      getTracks: () => tracks
    } as unknown as MediaStream
  };
}

describe("Zoom camera and microphone preflight", () => {
  it("requires both devices and releases the temporary tracks before Zoom starts", async () => {
    const { stream, tracks } = mediaStream(1, 1);
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    await expect(checkZoomCameraAndMicrophone({ getUserMedia }, true)).resolves.toBeUndefined();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
    expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true);
  });

  it("fails closed without a camera and still releases every opened track", async () => {
    const { stream, tracks } = mediaStream(1, 0);

    await expect(
      checkZoomCameraAndMicrophone({ getUserMedia: vi.fn().mockResolvedValue(stream) }, true)
    ).rejects.toMatchObject({ code: "camera" });
    expect(tracks[0].stop).toHaveBeenCalledOnce();
  });

  it("returns safe guidance for denied permissions and insecure pages", async () => {
    await expect(checkZoomCameraAndMicrophone(undefined, false)).rejects.toEqual(
      new ZoomMediaPreflightError("insecure")
    );
    const permissionError = await checkZoomCameraAndMicrophone(
      { getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) },
      true
    ).catch((error) => error);

    expect(getZoomMediaPreflightMessage(permissionError)).toContain("อนุญาตกล้องและไมโครโฟน");
  });
});
