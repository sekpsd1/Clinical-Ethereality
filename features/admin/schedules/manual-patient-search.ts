"use server";

import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import type { AdminManualAppointmentPatient } from "./types";

const patientName = z.string().trim().min(2).max(191);

export async function searchManualAppointmentPatients(name: string) {
  const session = await requireAdminSession();
  assertPermission(session, "consultation:manual-create");
  const parsed = patientName.safeParse(name);
  if (!parsed.success) return { patients: [], hasMore: false };

  const limit = 20;
  const matches = await prisma.$queryRaw<AdminManualAppointmentPatient[]>`
    SELECT id, fullName AS name FROM \`User\`
    WHERE role = 'customer'
      AND status = 'active'
      AND INSTR(fullName, ${parsed.data}) > 0
      AND nationalId REGEXP '^[0-9]{13}$'
      AND dateOfBirth IS NOT NULL
      AND phone <> ''
      AND normalizedPhone <> ''
      AND phoneVerifiedAt IS NOT NULL
    ORDER BY fullName, id
    LIMIT ${limit + 1}
  `;

  return { patients: matches.slice(0, limit), hasMore: matches.length > limit };
}
