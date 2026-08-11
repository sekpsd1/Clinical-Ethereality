import { NextResponse } from "next/server";
import { getZoomMeetingJoinData } from "@/features/consultations/zoom/queries";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ consultationId: string }> }) {
  const { consultationId } = await params;
  const data = await getZoomMeetingJoinData(consultationId);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}
