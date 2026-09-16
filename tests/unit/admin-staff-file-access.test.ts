import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  readStaffFile: vi.fn(),
  userFindFirst: vi.fn(),
  fileFindUnique: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/features/staff-files/service", () => ({ readStaffFile: mocks.readStaffFile }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst },
    fileAttachment: { findUnique: mocks.fileFindUnique }
  }
}));

import { GET } from "@/app/api/admin/staff-files/[attachmentId]/route";

const context = { params: Promise.resolve({ attachmentId: "attachment-1" }) };

describe("private Admin staff-file route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindFirst.mockResolvedValue({ id: "admin-1" });
    mocks.fileFindUnique.mockResolvedValue({
      entityType: "staff_license_proof",
      status: "attached",
      storageKey: "staff/hash/license/file.pdf",
      mimeType: "application/pdf"
    });
    mocks.readStaffFile.mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45]));
  });

  it.each([null, "customer", "doctor", "pharmacist"])("denies %s sessions", async (role) => {
    mocks.getCurrentSession.mockResolvedValue(
      role ? { userId: `${role}-1`, role } : null
    );
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(403);
    expect(mocks.fileFindUnique).not.toHaveBeenCalled();
  });

  it("denies a stale Admin token when the account is no longer active", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.userFindFirst.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(403);
    expect(mocks.fileFindUnique).not.toHaveBeenCalled();
  });

  it("serves an allowed staff file only to an active Admin without public caching", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
  });
});
