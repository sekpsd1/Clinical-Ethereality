import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  revalidatePath: vi.fn(),
  updateArticlePinState: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/features/community/pinning/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/community/pinning/service")>();
  return { ...actual, updateArticlePinState: mocks.updateArticlePinState };
});

import { updateArticlePinAction } from "@/features/community/pinning/actions";
import { ArticlePinError } from "@/features/community/pinning/service";

function form(action = "pin") {
  const value = new FormData();
  value.set("articleId", "article-1");
  value.set("action", action);
  return value;
}

describe("community article pin server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.updateArticlePinState.mockResolvedValue({ action: "pin", changed: true, pinned: true });
  });

  it("rejects missing and non-admin sessions before the service", async () => {
    for (const session of [null, { userId: "customer-1", role: "customer" }]) {
      mocks.getCurrentSession.mockResolvedValueOnce(session);
      await expect(updateArticlePinAction({ status: "idle", message: "" }, form())).resolves.toMatchObject({ status: "error" });
    }
    expect(mocks.updateArticlePinState).not.toHaveBeenCalled();
  });

  it("maps inactive-admin and maximum-three enforcement to safe live-state errors", async () => {
    mocks.updateArticlePinState.mockRejectedValueOnce(new ArticlePinError("unauthorized"));
    await expect(updateArticlePinAction({ status: "idle", message: "" }, form())).resolves.toEqual({
      status: "error",
      message: "เฉพาะบัญชี Admin ที่เปิดใช้งานเท่านั้นที่จัดการหมุดได้"
    });

    mocks.updateArticlePinState.mockRejectedValueOnce(new ArticlePinError("limit_reached"));
    await expect(updateArticlePinAction({ status: "idle", message: "" }, form())).resolves.toEqual({
      status: "error",
      message: "ปักหมุดครบ 3 โพสต์แล้ว กรุณาถอนหมุดเดิมก่อน"
    });
  });

  it("rejects malformed actions and revalidates all affected read surfaces after success", async () => {
    await expect(updateArticlePinAction({ status: "idle", message: "" }, form("archive"))).resolves.toMatchObject({ status: "error" });
    expect(mocks.updateArticlePinState).not.toHaveBeenCalled();

    await expect(updateArticlePinAction({ status: "idle", message: "" }, form())).resolves.toEqual({
      status: "success",
      message: "ปักหมุดโพสต์แล้ว"
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/community");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/community/search");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile/saved-articles");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/moderation");
  });
});
