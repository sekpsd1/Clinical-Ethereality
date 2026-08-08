import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  issueDoctorPrescription: vi.fn(),
  prismaTransaction: vi.fn(),
  revalidatePath: vi.fn(),
  requireDoctorSession: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/auth/guards", () => ({
  requireDoctorSession: mocks.requireDoctorSession
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.prismaTransaction
  }
}));

vi.mock("@/features/prescriptions/service", () => ({
  issueDoctorPrescription: mocks.issueDoctorPrescription
}));

import { submitPrescriptionAction } from "@/features/doctor/consultations/actions";

function formData(): FormData {
  const data = new FormData();
  data.set("consultationId", "consultation-1");
  data.set("productId", "product-1");
  data.set("dosage", "500 mg");
  data.set("quantity", "2");
  data.set("instructions", "Use as directed");
  return data;
}

function useTransaction(availableQuantity: number) {
  const tx = {
    product: {
      findFirst: vi.fn().mockResolvedValue({
        id: "product-1",
        name: "Canonical product name",
        inventory: {
          quantity: availableQuantity,
          reservedQuantity: 0
        }
      })
    }
  };

  mocks.prismaTransaction.mockImplementation(
    async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx)
  );

  return tx;
}

describe("doctor prescription product selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDoctorSession.mockResolvedValue({
      userId: "doctor-user-1",
      role: "doctor"
    });
  });

  it("uses the server-read product identity and requested quantity", async () => {
    const tx = useTransaction(5);

    await expect(submitPrescriptionAction({ status: "idle", message: "" }, formData())).resolves.toMatchObject({
      status: "success"
    });

    expect(tx.product.findFirst).toHaveBeenCalledWith({
      where: {
        id: "product-1",
        status: "active",
        requiresPrescription: true
      },
      include: {
        inventory: true
      }
    });
    expect(mocks.issueDoctorPrescription).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        medications: [
          expect.objectContaining({
            productId: "product-1",
            medicationName: "Canonical product name",
            quantity: "2"
          })
        ]
      })
    );
  });

  it("does not issue a prescription when current stock cannot cover the requested quantity", async () => {
    useTransaction(1);

    await expect(submitPrescriptionAction({ status: "idle", message: "" }, formData())).resolves.toMatchObject({
      status: "error"
    });

    expect(mocks.issueDoctorPrescription).not.toHaveBeenCalled();
  });
});
