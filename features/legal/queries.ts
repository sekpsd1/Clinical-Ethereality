import type { ConsentRecord } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import type { PublicSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { getRequiredLegalDocuments } from "@/features/legal/documents";
import type { CustomerConsentData, CustomerConsentItem } from "@/features/legal/types";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function toConsentKey(record: Pick<ConsentRecord, "type" | "version">): string {
  return `${record.type}:${record.version}`;
}

export async function getCustomerConsentData(session: PublicSession | null): Promise<CustomerConsentData> {
  noStore();

  const documents = getRequiredLegalDocuments();

  if (!session) {
    return {
      items: documents.map<CustomerConsentItem>((document) => ({
        ...document,
        accepted: false,
        acceptedAt: null
      })),
      acceptedCount: 0,
      requiredCount: documents.length
    };
  }

  try {
    const records = await prisma.consentRecord.findMany({
      where: {
        userId: session.userId,
        revokedAt: null,
        OR: documents.map((document) => ({
          type: document.type,
          version: document.version
        }))
      },
      select: {
        type: true,
        version: true,
        acceptedAt: true
      }
    });
    const acceptedByKey = new Map(records.map((record) => [toConsentKey(record), record]));
    const items = documents.map<CustomerConsentItem>((document) => {
      const record = acceptedByKey.get(`${document.type}:${document.version}`);

      return {
        ...document,
        accepted: Boolean(record),
        acceptedAt: record ? formatDate(record.acceptedAt) : null
      };
    });

    return {
      items,
      acceptedCount: items.filter((item) => item.accepted).length,
      requiredCount: items.length
    };
  } catch {
    return {
      items: documents.map<CustomerConsentItem>((document) => ({
        ...document,
        accepted: false,
        acceptedAt: null
      })),
      acceptedCount: 0,
      requiredCount: documents.length,
      unavailable: true
    };
  }
}
