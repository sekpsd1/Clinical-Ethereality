import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import {
  communityImageEntityType,
  readCommunityImage
} from "@/features/community/images/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ attachmentId: string }>;
  }
) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { attachmentId } = await context.params;
  const attachment = await prisma.fileAttachment.findUnique({
    where: {
      id: attachmentId
    },
    select: {
      entityId: true,
      entityType: true,
      ownerId: true,
      status: true,
      storageKey: true,
      mimeType: true
    }
  });

  if (
    !attachment ||
    attachment.status !== "attached" ||
    attachment.entityType !== communityImageEntityType ||
    !attachment.storageKey
  ) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const article = await prisma.article.findUnique({
    where: {
      id: attachment.entityId
    },
    select: {
      authorId: true,
      status: true
    }
  });

  const canView =
    article &&
    attachment.ownerId === article.authorId &&
    (article.status === "published" ||
      article.authorId === session.userId ||
      session.role === "admin");

  if (!canView) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  try {
    const bytes = await readCommunityImage(attachment.storageKey);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Type": attachment.mimeType ?? "image/webp",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
