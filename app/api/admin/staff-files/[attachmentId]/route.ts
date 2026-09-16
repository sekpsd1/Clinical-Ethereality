import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { readStaffFile } from "@/features/staff-files/service";
import { staffFileEntityTypes } from "@/features/staff-files/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> }
) {
  const session = await getCurrentSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const activeAdmin = await prisma.user.findFirst({
    where: {
      id: session.userId,
      role: "admin",
      status: "active"
    },
    select: { id: true }
  });

  if (!activeAdmin) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { attachmentId } = await context.params;
  const attachment = await prisma.fileAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      entityType: true,
      status: true,
      storageKey: true,
      mimeType: true
    }
  });

  if (
    !attachment ||
    attachment.status !== "attached" ||
    !attachment.storageKey ||
    (attachment.entityType !== staffFileEntityTypes.profilePhoto &&
      attachment.entityType !== staffFileEntityTypes.licenseProof)
  ) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  try {
    const bytes = await readStaffFile(attachment.storageKey);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Type": attachment.mimeType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
