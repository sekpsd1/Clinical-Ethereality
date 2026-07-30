import Link from "next/link";
import type { Route } from "next";
import { ZoomMeetingClient } from "@/features/consultations/zoom/ZoomMeetingClient";
import { getZoomMeetingJoinData } from "@/features/consultations/zoom/queries";

export default async function ZoomConsultationPage({
  searchParams
}: {
  searchParams: Promise<{
    consultation?: string;
  }>;
}) {
  const { consultation } = await searchParams;
  const data = await getZoomMeetingJoinData(consultation);
  const backHref = consultation ? `/consult/live?consultation=${consultation}` : "/consult";

  return (
    <section className="-mx-4 flex min-h-dvh flex-col justify-center bg-app px-4 py-8">
      <div id="zmmtg-root" />
      {data.available ? (
        <ZoomMeetingClient data={data} />
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
