"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireDoctorSession } from "@/lib/auth/guards";
import {
  submitPrescriptionSchema,
  updatePrescriptionOutcomeSchema
} from "@/features/doctor/consultations/schema";
import { issueDoctorPrescription } from "@/features/prescriptions/service";
import {
  ConsultationPrescriptionOutcomeError,
  setConsultationPrescriptionOutcome
} from "@/features/prescriptions/outcome";

export type DoctorPrescriptionActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type DoctorPrescriptionOutcomeActionState = DoctorPrescriptionActionState;

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function submitPrescriptionAction(
  _previousState: DoctorPrescriptionActionState,
  formData: FormData
): Promise<DoctorPrescriptionActionState> {
  const session = await requireDoctorSession();
  const parsed = submitPrescriptionSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณาระบุชื่อยา ขนาดยา จำนวน และวิธีใช้ให้ครบ"
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: {
            id: parsed.data.productId,
            status: "active",
            requiresPrescription: true
          },
          include: {
            inventory: true
          }
        });

        const availableQuantity = Math.max(
          (product?.inventory?.quantity ?? 0) - (product?.inventory?.reservedQuantity ?? 0),
          0
        );

        if (!product || availableQuantity < parsed.data.quantity) {
          throw new Error("Selected prescription product is unavailable.");
        }

        await issueDoctorPrescription(tx, {
          consultationId: parsed.data.consultationId,
          notes: parsed.data.notes ?? "",
          medications: [
            {
              productId: product.id,
              medicationName: product.name,
              dosage: parsed.data.dosage,
              quantity: String(parsed.data.quantity),
              instructions: parsed.data.instructions,
              warnings: parsed.data.warnings || undefined
            }
          ],
          actorId: session.userId,
          actorRole: session.role
        });
      },
      {
        isolationLevel: "Serializable"
      }
    );
  } catch {
    return {
      status: "error",
      message: "ยังส่งใบสั่งยาไม่ได้ กรุณาตรวจสอบสถานะ consult แล้วลองใหม่"
    };
  }

  revalidatePath("/doctor/consultations");
  revalidatePath("/doctor/patients");
  revalidatePath("/pharmacist/prescriptions");
  revalidatePath("/admin");
  revalidatePath("/consult/prescriptions");
  revalidatePath("/notifications");

  return {
    status: "success",
    message: "ออกใบสั่งยาแล้ว ลูกค้าสามารถนำไปสั่งซื้อได้ทันที"
  };
}

function getOutcomeErrorMessage(error: unknown): string {
  if (!(error instanceof ConsultationPrescriptionOutcomeError)) {
    return "ยังบันทึกผลสรุปใบสั่งยาไม่ได้ กรุณาลองใหม่";
  }

  if (error.code === "invalid_lifecycle") {
    return "บันทึกผลสรุปใบสั่งยาได้หลังจบการปรึกษาแล้วเท่านั้น";
  }

  if (error.code === "missing_active_prescription") {
    return "เลือก “มีใบสั่งยา” ได้เมื่อออกใบสั่งยาจริงในระบบแล้วเท่านั้น";
  }

  if (error.code === "active_prescription_conflict") {
    return "การปรึกษานี้มีใบสั่งยาที่ใช้งานอยู่ จึงเปลี่ยนเป็นสถานะอื่นไม่ได้";
  }

  if (error.code === "forbidden") {
    return "เฉพาะแพทย์ผู้รับผิดชอบการปรึกษานี้เท่านั้นที่บันทึกผลได้";
  }

  return "ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง";
}

export async function updatePrescriptionOutcomeAction(
  _previousState: DoctorPrescriptionOutcomeActionState,
  formData: FormData
): Promise<DoctorPrescriptionOutcomeActionState> {
  const session = await requireDoctorSession();
  const parsed = updatePrescriptionOutcomeSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณาเลือกผลสรุปใบสั่งยา"
    };
  }

  try {
    await prisma.$transaction(
      (tx) =>
        setConsultationPrescriptionOutcome(tx, {
          consultationId: parsed.data.consultationId,
          nextStatus: parsed.data.prescriptionOutcomeStatus,
          actorId: session.userId,
          actorRole: session.role
        }),
      {
        isolationLevel: "Serializable"
      }
    );
  } catch (error) {
    return {
      status: "error",
      message: getOutcomeErrorMessage(error)
    };
  }

  revalidatePath("/doctor/consultations");
  revalidatePath("/doctor/patients");
  revalidatePath("/admin");
  revalidatePath("/consult/prescriptions");

  return {
    status: "success",
    message: "บันทึกผลสรุปใบสั่งยาแล้ว"
  };
}
