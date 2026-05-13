import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ ok: false, session: null }, { status: 401 });
  }

  return NextResponse.json({ ok: true, session });
}
