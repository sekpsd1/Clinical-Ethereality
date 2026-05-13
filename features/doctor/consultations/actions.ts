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
      message: "Prescription note must be at least 5 characters."
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
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

      const latestPrescription = consultation.prescriptions[0] ?? null;
      const canUpdateLatest = latestPrescription?.status === "draft" || latestPrescription?.status === "rejected";

      if (canUpdateLatest) {
        await tx.prescription.update({
          where: {
            id: latestPrescription.id
          },
          data: {
            notes: parsed.data.notes,
            status: "pending_verification",
            verifiedAt: null
          }
        });
        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "prescription.submit_for_verification",
          entityType: "prescription",
          entityId: latestPrescription.id,
          metadata: {
            consultationId: consultation.id,
            patientId: consultation.patientId,
            previousStatus: latestPrescription.status,
            nextStatus: "pending_verification"
          }
        });
        await tx.notification.create({
          data: {
            userId: consultation.patientId,
            type: "prescription",
            channel: "in_app",
            title: "Prescription sent for verification",
            body: "Your doctor sent the prescription to the pharmacist for review.",
            metadataJson: {
              prescriptionId: latestPrescription.id,
              consultationId: consultation.id,
              href: "/consult/prescriptions"
            }
          }
        });
        return;
      }

      const prescription = await tx.prescription.create({
        data: {
          consultationId: consultation.id,
          patientId: consultation.patientId,
          doctorId: consultation.doctorId,
          notes: parsed.data.notes,
          status: "pending_verification"
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "prescription.submit_for_verification",
        entityType: "prescription",
        entityId: prescription.id,
        metadata: {
          consultationId: consultation.id,
          patientId: consultation.patientId,
          nextStatus: "pending_verification"
        }
      });
      await tx.notification.create({
        data: {
          userId: consultation.patientId,
          type: "prescription",
          channel: "in_app",
          title: "Prescription sent for verification",
          body: "Your doctor sent the prescription to the pharmacist for review.",
          metadataJson: {
            prescriptionId: prescription.id,
            consultationId: consultation.id,
            href: "/consult/prescriptions"
          }
        }
      });
    });
  } catch {
    return {
      status: "error",
      message: "Prescription could not be submitted. Check the consultation status and try again."
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
    message: "Prescription sent to pharmacist verification."
  };
}
