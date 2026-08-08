"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireDoctorSession } from "@/lib/auth/guards";
import { submitPrescriptionSchema } from "@/features/doctor/consultations/schema";
import { issueDoctorPrescription } from "@/features/prescriptions/service";

export type DoctorPrescriptionActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

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
    await prisma.$transaction(async (tx) => {
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
    });
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
