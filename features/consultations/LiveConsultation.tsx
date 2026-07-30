import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { Camera, Mic, Phone, RefreshCw, Settings } from "lucide-react";
import { ConsultationMessageComposer } from "@/features/consultations/chat/ConsultationMessageComposer";
import { ConsultationChatAutoRefresh } from "@/features/consultations/chat/ConsultationChatAutoRefresh";
import type { LiveConsultationChatData } from "@/features/consultations/chat/types";

export function LiveConsultation({ chat }: { chat: LiveConsultationChatData }) {
  return (
    <section className="-mx-4 flex h-dvh flex-col overflow-hidden bg-[#eceef0]">
      <ConsultationChatAutoRefresh enabled={Boolean(chat.consultationId && chat.canSend)} />
      <LiveHeader chat={chat} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-[76px]">
        <VideoPanel chat={chat} />
        <ChatTranscript chat={chat} />
        <MessageComposer chat={chat} />
      </main>
    </section>
  );
}

function LiveHeader({ chat }: { chat: LiveConsultationChatData }) {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-[76px] max-w-[480px] items-center justify-between bg-white/70 px-6 py-4 shadow-live-header backdrop-blur-topbar">
      <div className="flex items-center gap-3">
        <div className="relative size-10 rounded-full border-2 border-primary/20 bg-[#e0f4f4]">
          <Image src={chat.doctorImageUrl} alt={chat.doctorName} fill sizes="40px" className="rounded-full object-cover" />
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-green-500" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold leading-tight text-[#115e59]">{chat.doctorName}</h1>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-danger">
            <span className="size-2 rounded-full bg-danger" />
            {chat.statusLabel}
          </p>
        </div>
      </div>
      <button type="button" aria-label="Consultation settings" disabled className="flex size-10 items-center justify-center rounded-full text-[#64748b]/50">
        <Settings aria-hidden="true" className="size-6" strokeWidth={2.1} />
      </button>
    </header>
  );
}

function VideoPanel({ chat }: { chat: LiveConsultationChatData }) {
  return (
    <section className="shrink-0 px-4 py-2">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[#151616] shadow-video-panel">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_45%)]" />
        {chat.videoHref ? (
          <Link
            href={chat.videoHref as Route}
            target={chat.videoMode === "external" ? "_blank" : undefined}
            rel={chat.videoMode === "external" ? "noreferrer" : undefined}
            aria-label="เปิดห้อง Zoom"
            className="absolute left-1/2 top-[43%] flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-black/40 bg-black/30 text-[#d7eeee] shadow-qr-inset"
          >
            <span className="ml-1 h-0 w-0 border-y-[15px] border-l-[25px] border-y-transparent border-l-[#d7eeee]" />
          </Link>
        ) : (
          <div className="absolute left-1/2 top-[43%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[8px] bg-black/45 px-4 py-3 text-center text-xs font-semibold leading-5 text-white">
            ยังไม่ได้สร้างห้อง Zoom
          </div>
        )}

        <div className="absolute right-3 top-3 h-32 w-24 overflow-hidden rounded-xl border-2 border-white/20 bg-[#2f9b99] shadow-avatar">
          <Image src={chat.patientImageUrl} alt="Patient preview" fill sizes="96px" className="object-cover" />
        </div>

        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/30 px-4 py-2 shadow-live-controls backdrop-blur-topbar">
          <VideoControl label="ควบคุมไมโครโฟนใน Zoom" icon={Mic} disabled />
          <VideoControl label="ควบคุมกล้องใน Zoom" icon={Camera} disabled />
          <VideoControl label="สลับกล้องใน Zoom" icon={RefreshCw} disabled />
        </div>
      </div>
    </section>
  );
}

function VideoControl({
  label,
  icon: Icon,
  disabled = false
}: {
  label: string;
  icon: typeof Mic;
  disabled?: boolean;
}) {
  return (
    <button type="button" aria-label={label} disabled={disabled} className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-45">
      <Icon aria-hidden="true" className="size-5" strokeWidth={2.2} />
    </button>
  );
}

function ChatTranscript({ chat }: { chat: LiveConsultationChatData }) {
  return (
    <section className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
      {chat.messages.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-primary/20 bg-white/60 p-4 text-center text-xs leading-5 text-[#3e494a]">
          {chat.consultationId ? "ยังไม่มีข้อความในการปรึกษานี้" : "ไม่พบห้องปรึกษาที่บัญชีนี้เข้าถึงได้"}
        </div>
      ) : null}
      {chat.messages.map((message) => (
        <div key={message.id} className={message.isOwnMessage ? "flex flex-col items-end gap-2" : "flex flex-col items-start gap-2"}>
          <div
            className={
              message.isOwnMessage
                ? "max-w-[85%] rounded-2xl rounded-tr-none border border-white/50 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-chat-bubble backdrop-blur-topbar"
                : "max-w-[85%] rounded-2xl rounded-tl-none border border-primary/10 bg-[#d9eeee]/80 px-4 py-3 text-sm leading-relaxed text-[#134e4a] shadow-chat-bubble backdrop-blur-topbar"
            }
          >
            {message.body}
          </div>
          <span className={message.isOwnMessage ? "mr-1 text-[10px] text-[#3e494a]/60" : "ml-1 text-[10px] text-[#3e494a]/60"}>
            {message.createdAt}
          </span>
        </div>
      ))}

    </section>
  );
}

function MessageComposer({ chat }: { chat: LiveConsultationChatData }) {
  return (
    <footer className="shrink-0 border-t border-white/20 bg-white/70 p-4 backdrop-blur-topbar">
      <div className="flex items-end gap-3">
        <ConsultationMessageComposer consultationId={chat.consultationId} canSend={chat.canSend} />

        <Link href={chat.returnHref as Route} aria-label="ออกจากห้องปรึกษา" className="mb-1 flex flex-col items-center gap-1 text-danger">
          <span className="flex size-12 items-center justify-center rounded-full bg-danger text-white shadow-live-end">
            <Phone aria-hidden="true" className="size-6 fill-white" strokeWidth={2.2} />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-normal">
            {chat.viewerRole === "doctor" || chat.viewerRole === "admin" ? "กลับคิว" : "วางสาย"}
          </span>
        </Link>
      </div>
      <div className="mx-auto mt-4 h-1 w-32 rounded-full bg-slate-200/80" />
    </footer>
  );
}
