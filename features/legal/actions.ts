"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { getLegalDocument } from "@/features/legal/documents";
import { acceptConsentSchema } from "@/features/legal/schema";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function getClientIp(headerStore: Headers): string | null {
  const forwardedFor = headerStore.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return headerStore.get("x-real-ip");
}

export async function acceptCustomerConsentAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "profile:update:self");

  const parsed = acceptConsentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return;
  }

  const document = getLegalDocument(parsed.data.type);

  if (!document || document.version !== parsed.data.version) {
    return;
  }

  const headerStore = await headers();
  const ipAddress = getClientIp(headerStore);
  const userAgent = headerStore.get("user-agent");

  await prisma.$transaction(async (tx) => {
    const consent = await tx.consentRecord.upsert({
      where: {
        userId_type_version: {
          userId: session.userId,
          type: document.type,
          version: document.version
        }
      },
      create: {
        userId: session.userId,
        type: document.type,
        version: document.version,
        ipAddress,
        userAgent,
        metadataJson: {
          title: document.title,
          source: "profile_settings_privacy"
        }
      },
      update: {
        acceptedAt: new Date(),
        revokedAt: null,
        ipAddress,
        userAgent,
        metadataJson: {
          title: document.title,
          source: "profile_settings_privacy"
        }
      },
      select: {
        id: true
      }
    });

    await writeAuditLog(tx, {
      actorId: session.userId,
      action: "consent.accept",
      entityType: "consent_record",
      entityId: consent.id,
      metadata: {
        consentType: document.type,
        version: document.version,
        title: document.title
      }
    });
  });

  revalidatePath("/profile/settings");
  revalidatePath("/profile/settings?section=privacy");
}
