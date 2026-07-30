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
      await issueDoctorPrescription(tx, {
        consultationId: parsed.data.consultationId,
        notes: parsed.data.notes ?? "",
        medications: [
          {
            medicationName: parsed.data.medicationName,
            dosage: parsed.data.dosage,
            quantity: parsed.data.quantity,
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
