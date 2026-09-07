import Link from "next/link";
import type { Route } from "next";
import { ZoomExternalLauncher } from "@/features/consultations/zoom/ZoomExternalLauncher";
import { getZoomMeetingLaunchAccess } from "@/features/consultations/zoom/queries";
import { getAppEnv } from "@/lib/env/schema";

export default async function ZoomConsultationPage({
  searchParams
}: {
  searchParams: Promise<{
    consultation?: string;
  }>;
}) {
  const { consultation } = await searchParams;
  const data = await getZoomMeetingLaunchAccess(consultation);
  const backHref = consultation ? `/consult/live?consultation=${consultation}` : "/consult";
  const liffId = getAppEnv().NEXT_PUBLIC_LINE_LIFF_ID;

  return (
    <section className="-mx-4 flex min-h-dvh flex-col justify-center bg-app px-4 py-8">
      {data.available ? (
        <ZoomExternalLauncher consultationId={data.consultationId} liffId={liffId} />
      ) : (
        <div className="rounded-[8px] border border-dashed border-border bg-white/75 p-6 text-center">
          <h1 className="font-headline text-lg font-bold text-text">ยังเปิด Zoom ไม่ได้</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{data.message}</p>
        </div>
      )}
      <Link
        href={backHref as Route}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-primary/20 bg-white text-sm font-bold text-primary"
      >
        กลับห้องปรึกษา
      </Link>
    </section>
  );
}
