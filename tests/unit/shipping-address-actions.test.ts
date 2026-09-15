import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSession } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  session: null as PublicSession | null,
  tx: {
    $queryRaw: vi.fn(),
    user: {},
    shippingAddress: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    }
  },
  transaction: vi.fn(),
  audit: vi.fn(),
  revalidatePath: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession: vi.fn(async () => {
    if (!mocks.session) throw new Error("Authentication is required.");
    return mocks.session;
  })
}));
vi.mock("@/lib/permissions", () => ({ assertPermission: vi.fn() }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.audit }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mocks.transaction }
}));

import { saveShippingAddressAction } from "@/features/profile/shipping-addresses/actions";

const customerSession: PublicSession = {
  userId: "customer-1",
  lineUserId: "line-1",
  role: "customer",
  expiresAt: "2026-09-16T00:00:00.000Z"
};

function addressForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values = {
    label: "บ้าน",
    recipientName: "ลูกค้า ทดสอบ",
    phone: "0812345678",
    addressLine1: "1 ถนนสุขุมวิท",
    addressLine2: "",
    province: "กรุงเทพมหานคร",
    district: "คลองเตย",
    subdistrict: "คลองเตย",
    postalCode: "10110",
    isDefault: "true",
    ...overrides
  };
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("shipping address Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = customerSession;
    mocks.tx.$queryRaw.mockResolvedValue([{ id: "customer-1" }]);
    mocks.tx.shippingAddress.findFirst.mockResolvedValue(null);
    mocks.tx.shippingAddress.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.shippingAddress.create.mockResolvedValue({ id: "address-1", isDefault: true });
    mocks.transaction.mockImplementation(async (operation: (tx: typeof mocks.tx) => unknown) => operation(mocks.tx));
  });

  it("creates a canonical address for the active authenticated customer without PII in audit metadata", async () => {
    await expect(saveShippingAddressAction({ status: "idle", message: "" }, addressForm())).resolves.toMatchObject({ status: "success" });

    expect(mocks.tx.shippingAddress.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "customer-1",
        province: "กรุงเทพมหานคร",
        district: "คลองเตย",
        subdistrict: "คลองเตย",
        postalCode: "10110"
      })
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({ metadata: { isDefault: true } })
    );
    expect(JSON.stringify(mocks.audit.mock.calls[0])).not.toContain("ลูกค้า ทดสอบ");
    expect(JSON.stringify(mocks.audit.mock.calls[0])).not.toContain("0812345678");
  });

  it("rejects direct hierarchy tampering before creating an address", async () => {
    const result = await saveShippingAddressAction(
      { status: "idle", message: "" },
      addressForm({ district: "พระนคร" })
    );

    expect(result).toMatchObject({ status: "error" });
    expect(result.message).toContain("ไม่สัมพันธ์กัน");
    expect(mocks.tx.shippingAddress.create).not.toHaveBeenCalled();
  });

  it("rejects editing an address outside the signed-in customer account", async () => {
    const result = await saveShippingAddressAction(
      { status: "idle", message: "" },
      addressForm({ addressId: "other-address" })
    );

    expect(result).toMatchObject({ status: "error" });
    expect(mocks.tx.shippingAddress.update).not.toHaveBeenCalled();
  });

  it("rejects a customer whose database account is no longer active", async () => {
    mocks.tx.$queryRaw.mockResolvedValue([]);

    const result = await saveShippingAddressAction(
      { status: "idle", message: "" },
      addressForm()
    );

    expect(result).toMatchObject({ status: "error" });
    expect(mocks.tx.shippingAddress.create).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("rejects a non-customer session before opening a transaction", async () => {
    mocks.session = { ...customerSession, role: "doctor" };

    await expect(
      saveShippingAddressAction({ status: "idle", message: "" }, addressForm())
    ).rejects.toThrow("CUSTOMER_REQUIRED");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
