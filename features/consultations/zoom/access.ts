import type { Prisma } from "@prisma/client";

export type ZoomConsultationViewer = {
  userId: string;
  role: "customer" | "doctor";
  displayName?: string | null;
};

export function buildZoomConsultationAccessWhere(
  viewer: ZoomConsultationViewer,
  consultationId: string,
  now: Date
): Prisma.ConsultationWhereInput {
  const shared = {
    id: consultationId,
    status: "live" as const,
    scheduledAt: {
      lte: now
    }
  };

  if (viewer.role === "doctor") {
    return {
      ...shared,
      doctor: {
        userId: viewer.userId,
        user: {
          id: viewer.userId,
          role: "doctor",
          status: "active"
        }
      }
    };
  }

  return {
    ...shared,
    patientId: viewer.userId,
    patient: {
      id: viewer.userId,
      role: "customer",
      status: "active",
      fullName: { not: null },
      dateOfBirth: { not: null },
      normalizedPhone: { not: null },
      phoneVerifiedAt: { not: null }
    }
  };
}
