import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPublicAppOrigin } from "@/lib/auth/line-oauth";
import {
  issueZoomExternalHandoff,
  ZoomExternalHandoffError
} from "@/features/consultations/zoom/external-handoff";
import {
  getRequestIpAddress,
  hasTrustedZoomHandoffOrigin
} from "@/features/consultations/zoom/handoff-request";

export const dynamic = "force-dynamic";

const consultationIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,191}$/);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  if (!hasTrustedZoomHandoffOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Unable to open this Zoom room." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsedId = consultationIdSchema.safeParse((await params).consultationId);

  if (!parsedId.success) {
    return NextResponse.json(
      { ok: false, error: "Unable to open this Zoom room." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const handoff = await issueZoomExternalHandoff(parsedId.data, {
      ipAddress: getRequestIpAddress(request)
    });
    const launchUrl = new URL("/zoom-sdk/index.html", getPublicAppOrigin(request.nextUrl.origin));
    launchUrl.searchParams.set("consultation", handoff.consultationId);
    launchUrl.hash = `handoff=${encodeURIComponent(handoff.ticket)}`;

    return NextResponse.json(
      {
        ok: true,
        launchUrl: launchUrl.toString(),
        expiresAt: handoff.expiresAt.toISOString()
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer"
        }
      }
    );
  } catch (error) {
    if (!(error instanceof ZoomExternalHandoffError)) {
      console.error("Zoom external handoff issuance failed.", {
        code: "unexpected"
      });
    }

    return NextResponse.json(
      { ok: false, error: "Unable to open this Zoom room." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
}
