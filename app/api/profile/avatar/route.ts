import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const allowedLineAvatarHosts = new Set(["profile.line-scdn.net"]);

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId
    },
    select: {
      avatarUrl: true
    }
  });

  if (!user?.avatarUrl) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let avatarUrl: URL;

  try {
    avatarUrl = new URL(user.avatarUrl);
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (avatarUrl.protocol !== "https:" || !allowedLineAvatarHosts.has(avatarUrl.hostname)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const response = await fetch(avatarUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  }).catch(() => null);
  const contentType = response?.headers.get("content-type");

  if (!response?.ok || !contentType?.startsWith("image/")) {
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "cache-control": "private, max-age=3600",
      "content-type": contentType
    }
  });
}
