import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prismaTransaction: vi.fn(),
  requireDoctorSession: vi.fn(),
  revalidatePath: vi.fn(),
  setConsultationPrescriptionOutcome: vi.fn()
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

vi.mock("@/features/prescriptions/outcome", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/prescriptions/outcome")>();

  return {
    ...original,
    setConsultationPrescriptionOutcome: mocks.setConsultationPrescriptionOutcome
  };
});

import { ConsultationPrescriptionOutcomeError } from "@/features/prescriptions/outcome";
import { updatePrescriptionOutcomeAction } from "@/features/doctor/consultations/actions";

function formData(status: string): FormData {
  const data = new FormData();
  data.set("consultationId", "consultation-1");
  data.set("prescriptionOutcomeStatus", status);
  return data;
}

describe("doctor prescription outcome action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDoctorSession.mockResolvedValue({
      userId: "doctor-user-1",
      role: "doctor"
    });
    mocks.prismaTransaction.mockImplementation(
      async (operation: (tx: { marker: string }) => Promise<unknown>) => operation({ marker: "tx" })
    );
  });

  it("passes the authenticated doctor and approved status to the domain service in a serializable transaction", async () => {
    await expect(
      updatePrescriptionOutcomeAction(
        { status: "idle", message: "" },
        formData("no_prescription")
      )
    ).resolves.toEqual({
      status: "success",
      message: "บันทึกผลสรุปใบสั่งยาแล้ว"
    });

    expect(mocks.setConsultationPrescriptionOutcome).toHaveBeenCalledWith(
      { marker: "tx" },
      {
        consultationId: "consultation-1",
        nextStatus: "no_prescription",
        actorId: "doctor-user-1",
        actorRole: "doctor"
      }
    );
    expect(mocks.prismaTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable"
    });
  });

  it("returns clear feedback instead of creating an empty prescription", async () => {
    mocks.setConsultationPrescriptionOutcome.mockRejectedValue(
      new ConsultationPrescriptionOutcomeError("missing_active_prescription")
    );

    await expect(
      updatePrescriptionOutcomeAction(
        { status: "idle", message: "" },
        formData("prescription_issued")
      )
    ).resolves.toEqual({
      status: "error",
      message: "เลือก “มีใบสั่งยา” ได้เมื่อออกใบสั่งยาจริงในระบบแล้วเท่านั้น"
    });
  });

  it("rejects values outside the three approved outcome statuses before the transaction", async () => {
    await expect(
      updatePrescriptionOutcomeAction(
        { status: "idle", message: "" },
        formData("unknown")
      )
    ).resolves.toEqual({
      status: "error",
      message: "กรุณาเลือกผลสรุปใบสั่งยา"
    });

    expect(mocks.prismaTransaction).not.toHaveBeenCalled();
  });
});
