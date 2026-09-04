import { prisma } from "@/lib/db/prisma";
import { storeStaffFiles } from "@/features/staff-files/service";
import type { StaffFileKind } from "@/features/staff-files/types";

export async function uploadAdminStaffFile(input: {
  actorId: string;
  ownerId: string;
  kind: StaffFileKind;
  file: File;
}) {
  const target = await prisma.user.findUnique({
    where: {
      id: input.ownerId
    }
  });

  if (!target) {
    throw new Error("USER_NOT_FOUND");
  }

  await storeStaffFiles({
    actorId: input.actorId,
    ownerId: input.ownerId,
    uploads: [
      {
        kind: input.kind,
        file: input.file
      }
    ]
  });
}
