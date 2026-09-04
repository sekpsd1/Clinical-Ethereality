import { describe, expect, it } from "vitest";
import { getPromptPayQrDownloadUrl } from "@/features/consultations/payment/qr-download";

describe("consultation payment QR download", () => {
  it("keeps the exact PNG data URL generated for the current consultation amount", () => {
    const qrDataUrl = "data:image/png;base64,cHJvbXB0cGF5LXFy";

    expect(getPromptPayQrDownloadUrl(qrDataUrl)).toBe(qrDataUrl);
  });

  it.each([null, "https://example.test/qr.png", "javascript:alert(1)", "data:text/html;base64,PHNjcmlwdD4="])(
    "does not expose unsafe or unsupported QR download URLs: %s",
    (qrDataUrl) => {
      expect(getPromptPayQrDownloadUrl(qrDataUrl)).toBeNull();
    }
  );
});
