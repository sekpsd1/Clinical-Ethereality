"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireDoctorSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { submitPrescriptionSchema } from "@/features/doctor/consultations/schema";

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
      message: "กรุณาระบุบันทึกใบสั่งยาอย่างน้อย 5 ตัวอักษร"
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const issuedAt = new Date();
      const consultation = await tx.consultation.findUnique({
        where: {
          id: parsed.data.consultationId
        },
        select: {
          id: true,
          patientId: true,
          doctorId: true,
          status: true,
          doctor: {
            select: {
              userId: true
            }
          },
          prescriptions: {
            orderBy: {
              updatedAt: "desc"
            },
            take: 1,
            select: {
              id: true,
              status: true
            }
          }
        }
      });

      if (!consultation) {
        throw new Error("Consultation not found.");
      }

      if (session.role === "doctor" && consultation.doctor.userId !== session.userId) {
        throw new Error("Doctor cannot update another doctor's consultation.");
      }

      if (consultation.status === "cancelled" || consultation.status === "requested" || consultation.status === "pending_payment") {
        throw new Error("Consultation is not ready for prescription writing.");
      }

      const notification = {
        userId: consultation.patientId,
        type: "prescription" as const,
        channel: "in_app" as const,
        title: "แพทย์ออกใบสั่งยาแล้ว",
        body: "คุณสามารถใช้ใบสั่งยานี้สั่งซื้อสินค้าที่ต้องใช้ใบสั่งยาได้ โดยไม่ต้องรอขั้นตอนตรวจเอกสารซ้ำ",
        metadataJson: {
          consultationId: consultation.id,
          href: "/consult/prescriptions"
        }
      };
      const latestPrescription = consultation.prescriptions[0] ?? null;
      const canUpdateLatest = latestPrescription?.status === "draft" || latestPrescription?.status === "rejected";

      if (canUpdateLatest) {
        await tx.prescription.update({
          where: {
            id: latestPrescription.id
          },
          data: {
            notes: parsed.data.notes,
            status: "verified",
            verifiedAt: issuedAt
          }
        });
        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "prescription.doctor_issued",
          entityType: "prescription",
          entityId: latestPrescription.id,
          metadata: {
            consultationId: consultation.id,
            patientId: consultation.patientId,
            previousStatus: latestPrescription.status,
            nextStatus: "verified",
            noAdditionalDocumentReview: true
          }
        });
        await tx.notification.create({
          data: {
            ...notification,
            metadataJson: {
              ...notification.metadataJson,
              prescriptionId: latestPrescription.id
            }
          }
        });
        return;
      }

      if (latestPrescription) {
        throw new Error("Consultation already has an active prescription.");
      }

      const prescription = await tx.prescription.create({
        data: {
          consultationId: consultation.id,
          patientId: consultation.patientId,
          doctorId: consultation.doctorId,
          notes: parsed.data.notes,
          status: "verified",
          verifiedAt: issuedAt
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "prescription.doctor_issued",
        entityType: "prescription",
        entityId: prescription.id,
        metadata: {
          consultationId: consultation.id,
          patientId: consultation.patientId,
          nextStatus: "verified",
          noAdditionalDocumentReview: true
        }
      });
      await tx.notification.create({
        data: {
          ...notification,
          metadataJson: {
            ...notification.metadataJson,
            prescriptionId: prescription.id
          }
        }
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
