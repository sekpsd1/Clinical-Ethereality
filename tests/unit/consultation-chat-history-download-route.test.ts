import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | {
    userId: string;
    lineUserId: string;
    role: "customer" | "doctor" | "admin";
    expiresAt: string;
  },
  exportHistory: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentSession: async () => mocks.session }));
vi.mock("@/features/consultations/chat/history-queries", () => ({
  consultationChatExportFilename: "clinical-lab-chat-history.txt",
  getConsultationChatExport: mocks.exportHistory
}));

import { GET } from "@/app/api/consultations/[consultationId]/chat-history/download/route";

const context = { params: Promise.resolve({ consultationId: "consultation-1" }) };

describe("consultation chat history download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = {
      userId: "customer-1",
      lineUserId: "line-customer-1",
      role: "customer",
      expiresAt: "2030-01-01T00:00:00.000Z"
    };
    mocks.exportHistory.mockResolvedValue({
      content: "\uFEFFประวัติแชต\nภาษาไทย\n",
      messageCount: 1
    });
  });

  it.each(["customer", "doctor"] as const)(
    "returns a generic Thai-readable attachment for an authorized %s with private security headers",
    async (role) => {
      mocks.session = {
        userId: `${role}-1`,
        lineUserId: `line-${role}-1`,
        role,
        expiresAt: "2030-01-01T00:00:00.000Z"
      };
      const response = await GET(
        new Request("http://localhost/api/consultations/consultation-1/chat-history/download"),
        context
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
      expect(response.headers.get("content-disposition")).toBe(
        'attachment; filename="clinical-lab-chat-history.txt"'
      );
      expect(response.headers.get("cache-control")).toContain("private, no-store");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(new TextDecoder().decode(bytes)).toBe("ประวัติแชต\nภาษาไทย\n");
      expect(mocks.exportHistory).toHaveBeenCalledWith(
        mocks.session,
        "consultation-1",
        role
      );
    }
  );

  it("redirects an unauthenticated external-browser request to LINE login without reading messages", async () => {
    mocks.session = null;
    const response = await GET(
      new Request("http://localhost/api/consultations/consultation-1/chat-history/download"),
      context
    );
    const location = new URL(response.headers.get("location")!);

    expect(response.status).toBe(307);
    expect(location.origin).toBe("http://localhost");
    expect(location.pathname).toBe("/auth/line");
    expect([...location.searchParams.keys()]).toEqual(["next"]);
    expect(location.searchParams.get("next")).toBe(
      "/api/consultations/consultation-1/chat-history/download"
    );
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.exportHistory).not.toHaveBeenCalled();
  });

  it("keeps an untrusted route parameter inside the encoded same-origin return path", async () => {
    mocks.session = null;
    const response = await GET(
      new Request("http://localhost/api/consultations/invalid/chat-history/download"),
      {
        params: Promise.resolve({
          consultationId: "consultation-1?next=https://attacker.example"
        })
      }
    );
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe("http://localhost");
    expect(location.pathname).toBe("/auth/line");
    expect([...location.searchParams.keys()]).toEqual(["next"]);
    expect(location.searchParams.get("next")).toBe(
      "/api/consultations/consultation-1%3Fnext%3Dhttps%3A%2F%2Fattacker.example/chat-history/download"
    );
    expect(mocks.exportHistory).not.toHaveBeenCalled();
  });

  it("denies non-history roles without reading messages", async () => {
    mocks.session = {
      userId: "admin-1",
      lineUserId: "line-admin-1",
      role: "admin",
      expiresAt: "2030-01-01T00:00:00.000Z"
    };
    const admin = await GET(
      new Request("http://localhost/api/consultations/consultation-1/chat-history/download"),
      context
    );
    expect(admin.status).toBe(404);
    await expect(admin.json()).resolves.toEqual({ error: "Chat history not found." });
    expect(admin.headers.get("cache-control")).toContain("private, no-store");
    expect(admin.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.exportHistory).not.toHaveBeenCalled();
  });

  it("returns the same generic not-found error for other owners, inactive users, and non-completed cases", async () => {
    mocks.exportHistory.mockResolvedValue(null);
    const response = await GET(
      new Request("http://localhost/api/consultations/consultation-1/chat-history/download"),
      context
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Chat history not found." });
    expect(JSON.stringify(payload)).not.toMatch(/consultation-1|patient|zoom|provider|ticket/i);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });
});
