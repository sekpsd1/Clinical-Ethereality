import {
  AudioLines,
  ChevronDown,
  FileText,
  MessageSquareText,
  ShieldCheck,
  Video
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  ConsultationRecordingKind,
  ConsultationRecordingListItem
} from "@/features/consultations/recordings/presentation";
import { RecordingHandoffActions } from "@/features/consultations/recordings/RecordingHandoffActions";

const recordingIcons: Record<ConsultationRecordingKind, typeof Video> = {
  audio: AudioLines,
  chat: MessageSquareText,
  file: FileText,
  transcript: FileText,
  video: Video
};

export function ConsultationRecordingsPanel({
  consultationId,
  recordings
}: {
  consultationId: string;
  recordings: ConsultationRecordingListItem[];
}) {
  return (
    <details
      className="group mt-4 rounded-[8px] border border-primary/15 bg-primary/5"
      open={recordings.length > 0}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-white text-primary ring-1 ring-primary/10">
            <Video aria-hidden="true" className="size-4" strokeWidth={2.1} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-text">บันทึกการปรึกษา</h4>
            <p className="mt-0.5 text-[11px] leading-4 text-muted">เปิดดูหรือดาวน์โหลดไฟล์ที่ Zoom ประมวลผลเสร็จแล้ว</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge tone={recordings.length > 0 ? "success" : "neutral"}>
            {recordings.length > 0 ? `${recordings.length} ไฟล์` : "รอไฟล์"}
          </StatusBadge>
          <ChevronDown aria-hidden="true" className="size-4 text-muted transition-transform group-open:rotate-180" strokeWidth={2.1} />
        </div>
      </summary>

      <div className="px-3 pb-3">
        {recordings.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-border bg-white/75 px-3 py-4 text-center">
          <p className="text-xs font-bold text-text">ยังไม่มีไฟล์บันทึก</p>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            หากเพิ่งจบสาย กรุณารอ Zoom ประมวลผลสักครู่แล้วเปิดหน้านี้ใหม่
          </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
          {recordings.map((recording) => {
            const Icon = recordingIcons[recording.kind];
            const detailParts = [
              recording.recordedAtLabel,
              recording.durationLabel,
              recording.fileSizeLabel
            ].filter((value): value is string => Boolean(value));

            return (
              <li key={recording.id} className="rounded-[8px] border border-border/80 bg-white p-3">
                <div className="flex items-start gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="size-4" strokeWidth={2.1} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold text-text">{recording.title}</p>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[9px] font-bold text-muted ring-1 ring-border">
                        {recording.fileTypeLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-muted">{detailParts.join(" · ")}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-muted">เก็บรักษาถึง {recording.retentionUntilLabel}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <RecordingHandoffActions consultationId={consultationId} recordingId={recording.id} />
                </div>
              </li>
            );
          })}
          </ul>
        )}

        <div className="mt-3 flex items-start gap-2 border-t border-primary/10 pt-3 text-[10px] leading-4 text-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2.1} />
          <p>เฉพาะแอดมินและแพทย์ผู้รับผิดชอบเคสนี้เท่านั้น ทุกครั้งที่เปิดดูหรือดาวน์โหลดระบบจะบันทึกรายการเข้าถึง</p>
        </div>
      </div>
    </details>
  );
}
