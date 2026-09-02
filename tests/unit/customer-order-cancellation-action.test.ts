import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  assertRole: vi.fn(),
  assertPermission: vi.fn(),
  cancelCustomerPendingStoreOrder: vi.fn(),
  revalidatePath: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: actionMocks.revalidatePath
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession: actionMocks.requireCurrentSession
}));

vi.mock("@/lib/permissions", () => ({
  assertRole: actionMocks.assertRole,
  assertPermission: actionMocks.assertPermission
}));

vi.mock("@/features/orders/reservations", () => ({
  cancelCustomerPendingStoreOrder: actionMocks.cancelCustomerPendingStoreOrder
}));

import { cancelCustomerOrderAction } from "@/features/orders/actions";

function cancellationFormData(orderId = "order-1") {
  const formData = new FormData();
  formData.set("orderId", orderId);
  return formData;
}

const initialState = {
  status: "idle" as const,
  message: ""
};

describe("Customer order cancellation Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionMocks.requireCurrentSession.mockResolvedValue({
      userId: "customer-1",
      lineUserId: "line-customer-1",
      role: "customer",
      expiresAt: "2026-08-08T12:00:00.000Z"
    });
  });

  it("requires a customer session and passes the authenticated owner to the domain service", async () => {
    actionMocks.cancelCustomerPendingStoreOrder.mockResolvedValue("cancelled");

    await expect(
      cancelCustomerOrderAction(initialState, cancellationFormData())
    ).resolves.toEqual({
      status: "success",
      message: "ยกเลิกคำสั่งซื้อและคืนสต็อกที่สำรองไว้แล้ว"
    });

    expect(actionMocks.requireCurrentSession).toHaveBeenCalledTimes(1);
    expect(actionMocks.assertRole).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "customer-1", role: "customer" }),
      ["customer"]
    );
    expect(actionMocks.assertPermission).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "customer-1" }),
      "order:read:self"
    );
    expect(actionMocks.cancelCustomerPendingStoreOrder).toHaveBeenCalledWith({
      orderId: "order-1",
      userId: "customer-1"
    });
    expect(actionMocks.revalidatePath).toHaveBeenCalledWith("/store/orders/order-1");
    expect(actionMocks.revalidatePath).toHaveBeenCalledWith("/store/orders");
    expect(actionMocks.revalidatePath).toHaveBeenCalledWith("/notifications");
  });

  it("returns the same success outcome for an idempotent rerun", async () => {
    actionMocks.cancelCustomerPendingStoreOrder.mockResolvedValue("already_cancelled");

    await expect(
      cancelCustomerOrderAction(initialState, cancellationFormData())
    ).resolves.toEqual({
      status: "success",
      message: "คำสั่งซื้อนี้ถูกยกเลิกแล้ว"
    });
  });

  it.each([
    ["not_found", "ไม่พบคำสั่งซื้อที่คุณมีสิทธิ์ยกเลิก"],
    ["blocked", "ยกเลิกได้เฉพาะคำสั่งซื้อที่ยังรอชำระเงินและยังไม่มีการชำระเงินสำเร็จ"]
  ] as const)("returns a safe error for %s", async (result, message) => {
    actionMocks.cancelCustomerPendingStoreOrder.mockResolvedValue(result);

    await expect(
      cancelCustomerOrderAction(initialState, cancellationFormData())
    ).resolves.toEqual({
      status: "error",
      message
    });

    expect(actionMocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed order IDs before calling the domain service", async () => {
    await expect(
      cancelCustomerOrderAction(initialState, cancellationFormData(""))
    ).resolves.toMatchObject({
      status: "error",
      message: "คำขอยกเลิกคำสั่งซื้อไม่ถูกต้อง"
    });

    expect(actionMocks.cancelCustomerPendingStoreOrder).not.toHaveBeenCalled();
  });

  it("returns a safe action error instead of throwing when a non-customer submits the action", async () => {
    actionMocks.assertRole.mockImplementation(() => {
      throw new Error("This role is not allowed to perform this action.");
    });

    await expect(
      cancelCustomerOrderAction(initialState, cancellationFormData())
    ).resolves.toEqual({
      status: "error",
      message: "ยกเลิกคำสั่งซื้อได้จากบัญชีลูกค้าเจ้าของรายการเท่านั้น"
    });

    expect(actionMocks.cancelCustomerPendingStoreOrder).not.toHaveBeenCalled();
    expect(actionMocks.revalidatePath).not.toHaveBeenCalled();
  });
});
