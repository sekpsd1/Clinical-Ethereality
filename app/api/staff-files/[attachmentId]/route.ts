import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { readStaffFile } from "@/features/staff-files/service";
import { staffFileEntityTypes } from "@/features/staff-files/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ attachmentId: string }>;
  }
) {
  const { attachmentId } = await context.params;
  const attachment = await prisma.fileAttachment.findUnique({
    where: {
      id: attachmentId
    },
    select: {
      entityType: true,
      status: true,
      storageKey: true,
      mimeType: true
    }
  });

  if (!attachment || attachment.status !== "attached" || !attachment.storageKey) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const isProfilePhoto = attachment.entityType === staffFileEntityTypes.profilePhoto;
  const isLicenseProof = attachment.entityType === staffFileEntityTypes.licenseProof;

  if (!isProfilePhoto && !isLicenseProof) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  if (isLicenseProof) {
    const session = await getCurrentSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
  }

  try {
    const bytes = await readStaffFile(attachment.storageKey);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "Cache-Control": isProfilePhoto ? "public, max-age=3600, immutable" : "private, no-store",
        "Content-Disposition": "inline",
        "Content-Type": attachment.mimeType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
