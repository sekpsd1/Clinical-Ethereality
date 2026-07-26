import { describe, expect, it } from "vitest";
import { validateStaffInviteFiles } from "@/features/staff-files/client-validation";

const MB = 1024 * 1024;

describe("staff invite client file validation", () => {
  it("accepts supported files within their limits", () => {
    expect(
      validateStaffInviteFiles({
        profilePhoto: { size: 2 * MB, type: "image/jpeg" },
        licenseProof: { size: 4 * MB, type: "application/pdf" }
      })
    ).toBeNull();
  });

  it("requires both files", () => {
    expect(
      validateStaffInviteFiles({
        profilePhoto: null,
        licenseProof: { size: MB, type: "application/pdf" }
      })
    ).toContain("รูปโปรไฟล์");
  });

  it("rejects an oversized profile photo", () => {
    expect(
      validateStaffInviteFiles({
        profilePhoto: { size: 5 * MB + 1, type: "image/png" },
        licenseProof: { size: MB, type: "application/pdf" }
      })
    ).toContain("5 MB");
  });

  it("rejects an oversized license proof", () => {
    expect(
      validateStaffInviteFiles({
        profilePhoto: { size: MB, type: "image/webp" },
        licenseProof: { size: 10 * MB + 1, type: "application/pdf" }
      })
    ).toContain("10 MB");
  });

  it("rejects unsupported file types", () => {
    expect(
      validateStaffInviteFiles({
        profilePhoto: { size: MB, type: "image/gif" },
        licenseProof: { size: MB, type: "application/pdf" }
      })
    ).toContain("JPG");
  });
});
