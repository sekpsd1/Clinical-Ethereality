import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { StaffInviteRequestData } from "@/features/staff-invite/schema";

function optionalText(value?: string) {
  return value && value.length > 0 ? value : undefined;
}

export async function submitStaffInviteRequest(input: {
  userId: string;
  data: StaffInviteRequestData;
}) {
  if (input.data.role === "doctor") {
    throw new Error("DOCTOR_ADMIN_MANAGED");
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        id: input.userId
      },
      select: {
        status: true
      }
    });

    if (!user || user.status === "suspended" || user.status === "archived") {
      throw new Error("USER_NOT_ELIGIBLE");
    }

    if (input.data.role === "pharmacist") {
      await tx.pharmacist.upsert({
        where: {
          userId: input.userId
        },
        create: {
          userId: input.userId,
          licenseNumber: optionalText(input.data.licenseNumber),
          pharmacyName: optionalText(input.data.pharmacyName),
          status: "pending_review"
        },
        update: {
          licenseNumber: optionalText(input.data.licenseNumber),
          pharmacyName: optionalText(input.data.pharmacyName),
          status: "pending_review"
        }
      });
    }

    await tx.user.update({
      where: {
        id: input.userId
      },
      data: {
        displayName:
          input.data.role !== "admin"
            ? `${input.data.firstName} ${input.data.lastName}`
            : undefined,
        status: input.data.role === "admin" ? "pending_review" : undefined
      }
    });

    await writeAuditLog(tx, {
      actorId: input.userId,
      action: "staff_invite.request",
      entityType: "user",
      entityId: input.userId,
      metadata: {
        requestedRole: input.data.role
      }
    });
  });
}
