export type MediaDeviceAccess = Pick<MediaDevices, "getUserMedia">;

export class ZoomMediaPreflightError extends Error {
  constructor(public readonly code: "insecure" | "unsupported" | "camera" | "microphone" | "permission") {
    super(`zoom_media_${code}`);
    this.name = "ZoomMediaPreflightError";
  }
}

export async function checkZoomCameraAndMicrophone(
  mediaDevices: MediaDeviceAccess | undefined,
  secureContext: boolean
): Promise<void> {
  if (!secureContext) {
    throw new ZoomMediaPreflightError("insecure");
  }

  if (!mediaDevices?.getUserMedia) {
    throw new ZoomMediaPreflightError("unsupported");
  }

  let stream: MediaStream;

  try {
    stream = await mediaDevices.getUserMedia({ audio: true, video: true });
  } catch {
    throw new ZoomMediaPreflightError("permission");
  }

  try {
    if (stream.getAudioTracks().length === 0) {
      throw new ZoomMediaPreflightError("microphone");
    }

    if (stream.getVideoTracks().length === 0) {
      throw new ZoomMediaPreflightError("camera");
    }
  } finally {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
}

export function getZoomMediaPreflightMessage(error: unknown): string {
  if (!(error instanceof ZoomMediaPreflightError)) {
    return "ตรวจกล้องและไมโครโฟนไม่สำเร็จ กรุณาลองใหม่";
  }

  switch (error.code) {
    case "insecure":
      return "เบราว์เซอร์ต้องเปิดผ่าน HTTPS จึงจะใช้กล้องและไมโครโฟนได้";
    case "unsupported":
      return "เบราว์เซอร์นี้ไม่รองรับการตรวจกล้องและไมโครโฟน กรุณาอัปเดตหรือเปลี่ยนเบราว์เซอร์";
    case "camera":
      return "ไม่พบกล้องที่พร้อมใช้งาน กรุณาตรวจอุปกรณ์แล้วลองใหม่";
    case "microphone":
      return "ไม่พบไมโครโฟนที่พร้อมใช้งาน กรุณาตรวจอุปกรณ์แล้วลองใหม่";
    case "permission":
      return "กรุณาอนุญาตกล้องและไมโครโฟนในเบราว์เซอร์ แล้วกดตรวจอีกครั้ง";
  }
}
