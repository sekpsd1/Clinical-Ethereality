"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePharmacistSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { reviewPrescriptionSchema } from "@/features/pharmacist/prescriptions/schema";

export type PharmacistPrescriptionActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function reviewPrescriptionAction(
  _previousState: PharmacistPrescriptionActionState,
  formData: FormData
): Promise<PharmacistPrescriptionActionState> {
  const session = await requirePharmacistSession();
  const parsed = reviewPrescriptionSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขอตรวจใบสั่งยาไม่ถูกต้อง"
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.findUnique({
        where: {
          id: parsed.data.prescriptionId
        },
        select: {
          id: true,
          pharmacistId: true,
          status: true
        }
      });

      if (!prescription) {
        throw new Error("Prescription not found.");
      }

      if (prescription.status !== "pending_verification") {
        throw new Error("Prescription has already been reviewed.");
      }

      const pharmacist =
        session.role === "pharmacist"
          ? await tx.pharmacist.findUnique({
              where: {
                userId: session.userId
              },
              select: {
                id: true
              }
            })
          : null;

      if (session.role === "pharmacist" && !pharmacist) {
        throw new Error("Pharmacist profile is required.");
      }

      await tx.prescription.update({
        where: {
          id: prescription.id
        },
        data: {
          status: parsed.data.status,
          verifiedAt: parsed.data.status === "verified" ? new Date() : null,
          pharmacistId: pharmacist?.id ?? prescription.pharmacistId
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "prescription.review",
        entityType: "prescription",
        entityId: prescription.id,
        metadata: {
          previousStatus: prescription.status,
          nextStatus: parsed.data.status,
          pharmacistId: pharmacist?.id ?? prescription.pharmacistId
        }
      });
    });
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถบันทึกผลตรวจใบสั่งยาได้ กรุณาลองใหม่"
    };
  }

  revalidatePath("/admin");
  revalidatePath("/pharmacist/prescriptions");

  return {
    status: "success",
    message: parsed.data.status === "verified" ? "ยืนยันใบสั่งยาแล้ว" : "ปฏิเสธใบสั่งยาแล้ว"
  };
}
